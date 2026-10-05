import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Actions du bac à sable (S1c) : limites d'essais (B1, M4) et retrait du consentement (M6). Base simulée. */
const tx = { discoveryRequest: { delete: vi.fn(), deleteMany: vi.fn() } };
const db = {
  discoveryRequest: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  sandbox: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
vi.mock("@/server/db", () => ({ db }));
const logAudit = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/server/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
const hitRateLimit = vi.fn();
const hitRateLimits = vi.fn();
vi.mock("@/server/rate-limit", () => ({
  clientIp: async () => "198.51.100.4",
  hitRateLimit: (...a: unknown[]) => hitRateLimit(...a),
  hitRateLimits: (...a: unknown[]) => hitRateLimits(...a),
  retryMessage: () => "Trop d'essais. Réessayez dans 30 minutes.",
}));
const family = { id: "f1", email: "f@x.test", role: "FAMILLE" as const, firstName: "Nadia", lastName: "T", isDemo: false, sandboxId: "sbx1" };
vi.mock("@/server/auth/guards", () => ({ requireRole: async () => family, getCurrentUser: async () => family }));
const createSandbox = vi.fn();
class SandboxError extends Error {}
vi.mock("./service", () => ({ createSandbox: (...a: unknown[]) => createSandbox(...a), SandboxError }));
vi.mock("./robots", () => ({ simulateNext: vi.fn() }));
vi.mock("./events", () => ({ trackEvent: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const actions = await import("./actions");
const { initialActionState } = await import("@/lib/action-result");

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}
const START = { testerCode: "T-ABCD-FGHJ-KMNP", role: "FAMILLE", acceptCgu: "on", adult: "on", acceptTest: "on" };

beforeEach(() => {
  vi.clearAllMocks();
  hitRateLimit.mockResolvedValue({ allowed: true, count: 1, retryAfterSeconds: 0 });
  hitRateLimits.mockResolvedValue({ allowed: true, count: 1, retryAfterSeconds: 0 });
  process.env.TESTER_INVITE_CODES = "T-ABCD-FGHJ-KMNP";
});

describe("« Tester Koudmen » (B1)", () => {
  it("limite les essais de code par IP, avant même de lire le code", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, count: 31, retryAfterSeconds: 1800 });
    const r = await actions.startSandboxAction(initialActionState, form(START));
    expect(r).toMatchObject({ ok: false, error: "Trop d'essais. Réessayez dans 30 minutes." });
    expect(hitRateLimit).toHaveBeenCalledWith("code-testeur:ip", "198.51.100.4");
    expect(createSandbox).not.toHaveBeenCalled();
  });

  it("compte aussi les mauvais codes", async () => {
    const r = await actions.startSandboxAction(initialActionState, form({ ...START, testerCode: "NADIA-07" }));
    expect(r).toMatchObject({ ok: false, error: "Ce code testeur n'est pas valide." });
    expect(hitRateLimit).toHaveBeenCalledTimes(1);
  });
});

describe("offre « visite découverte » (M4, M6)", () => {
  const DISCOVERY = { name: "Nadia", contact: "nadia@exemple.test", consent: "on" };

  it("donne un lien de retrait unique : la base garde seulement l'empreinte", async () => {
    db.discoveryRequest.create.mockResolvedValue({ id: "d1" });
    let url = "";
    try {
      await actions.requestDiscoveryAction(initialActionState, form(DISCOVERY));
    } catch (e) {
      url = (e as Error).message;
    }
    const token = /retrait=([A-Za-z0-9_-]+)/.exec(url)?.[1];
    expect(token).toBeDefined();
    const data = db.discoveryRequest.create.mock.calls[0]![0].data;
    expect(data.withdrawTokenHash).toBe(createHash("sha256").update(token!).digest("hex"));
    expect(JSON.stringify(data)).not.toContain(token!);
    expect(JSON.stringify(logAudit.mock.calls)).not.toContain("nadia@exemple.test");
  });

  it("limite les demandes par compte et par IP", async () => {
    hitRateLimits.mockResolvedValue({ allowed: false, count: 4, retryAfterSeconds: 1800 });
    const r = await actions.requestDiscoveryAction(initialActionState, form(DISCOVERY));
    expect(r).toMatchObject({ ok: false });
    expect(db.discoveryRequest.create).not.toHaveBeenCalled();
  });

  it("retrait par lien : EFFACE le contact et journalise sans donnée personnelle", async () => {
    db.discoveryRequest.findUnique.mockResolvedValue({ id: "d1" });
    const token = "a".repeat(32);
    const r = await actions.withdrawDiscoveryByTokenAction(initialActionState, form({ token }));
    expect(r).toMatchObject({ ok: true });
    expect(db.discoveryRequest.findUnique).toHaveBeenCalledWith({
      where: { withdrawTokenHash: createHash("sha256").update(token).digest("hex") },
      select: { id: true },
    });
    expect(tx.discoveryRequest.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    expect(logAudit.mock.calls[0]![0]).toMatchObject({ action: "discovery.withdrawn", entityId: "d1" });
  });

  it("retrait par lien : jeton inconnu ou malformé → message neutre, rien n'est effacé", async () => {
    db.discoveryRequest.findUnique.mockResolvedValue(null);
    expect(await actions.withdrawDiscoveryByTokenAction(initialActionState, form({ token: "b".repeat(32) }))).toMatchObject({ ok: false });
    expect(await actions.withdrawDiscoveryByTokenAction(initialActionState, form({ token: "<script>" }))).toMatchObject({ ok: false });
    expect(tx.discoveryRequest.delete).not.toHaveBeenCalled();
  });

  it("retrait depuis l'espace : efface toutes les demandes du compte", async () => {
    db.discoveryRequest.findMany.mockResolvedValue([{ id: "d1" }, { id: "d2" }]);
    await expect(actions.withdrawMyDiscoveryAction()).rejects.toThrow("REDIRECT:/famille/visite-decouverte?retire=1");
    expect(tx.discoveryRequest.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["d1", "d2"] } } });
    expect(logAudit).toHaveBeenCalledTimes(2);
  });
});
