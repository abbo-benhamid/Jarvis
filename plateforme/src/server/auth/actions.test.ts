import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Actions d'authentification (S1c) : A10/M1 (inscription fermée), M3/M7 (déconnexion réelle),
 * M5 (limite d'essais à la connexion). Base et cookies simulés.
 */
const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore, headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const db = {
  user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
};
vi.mock("@/server/db", () => ({ db }));
const logAudit = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/server/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
const hitRateLimits = vi.fn();
const hitRateLimit = vi.fn();
vi.mock("@/server/rate-limit", () => ({
  clientIp: async () => "203.0.113.7",
  hitRateLimit: (...a: unknown[]) => hitRateLimit(...a),
  hitRateLimits: (...a: unknown[]) => hitRateLimits(...a),
  retryMessage: () => "Trop d'essais. Réessayez dans 10 minutes.",
}));

process.env.SESSION_SECRET = "un-secret-de-test-assez-long-pour-hs256-0123456789";
const { logoutAction, registerAction, loginAction } = await import("./actions");
const { signSessionToken, SESSION_COOKIE } = await import("./session-token");
const { RESUME_COOKIE } = await import("./session");
const { initialActionState } = await import("@/lib/action-result");

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  hitRateLimit.mockResolvedValue({ allowed: true, count: 1, retryAfterSeconds: 0 });
  hitRateLimits.mockResolvedValue({ allowed: true, count: 1, retryAfterSeconds: 0 });
});

describe("déconnexion (M3, M7)", () => {
  it("incrémente la version de session et efface la session ET le cookie de reprise", async () => {
    const token = await signSessionToken({ sub: "u1", role: "FAMILLE", name: "N", demo: false, sv: 4 }, new TextEncoder().encode(process.env.SESSION_SECRET!));
    cookieStore.get.mockImplementation((name: string) => (name === SESSION_COOKIE ? { value: token } : undefined));
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/");
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1" }, data: { sessionVersion: { increment: 1 } } });
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith(RESUME_COOKIE);
    expect(logAudit.mock.calls[0]![0]).toMatchObject({ action: "auth.logout" });
  });
});

describe("déconnexion d'un compte démo partagé (X6, sécurité D1)", () => {
  it("ne change PAS la version de session : les autres visiteurs restent connectés ; ce navigateur est déconnecté", async () => {
    const token = await signSessionToken({ sub: "demo1", role: "FAMILLE", name: "Sandrine", demo: true, sv: 0 }, new TextEncoder().encode(process.env.SESSION_SECRET!));
    cookieStore.get.mockImplementation((name: string) => (name === SESSION_COOKIE ? { value: token } : undefined));
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/");
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
    expect(logAudit.mock.calls[0]![0]).toMatchObject({ action: "auth.logout", metadata: { demoPartagee: true } });
  });
});

describe("inscription libre (A10, M1)", () => {
  it("est fermée si DEMO_MODE n'est pas true : renvoi vers /tester, aucun compte créé", async () => {
    process.env.DEMO_MODE = "false";
    await expect(registerAction(initialActionState, form({}))).rejects.toThrow("REDIRECT:/tester");
    expect(db.user.create).not.toHaveBeenCalled();
    delete process.env.DEMO_MODE;
    await expect(registerAction(initialActionState, form({}))).rejects.toThrow("REDIRECT:/tester");
  });
});

describe("connexion (M5)", () => {
  it("refuse au-delà de la limite, sans lire le compte, et journalise sans email", async () => {
    hitRateLimits.mockResolvedValue({ allowed: false, count: 21, retryAfterSeconds: 600 });
    const r = await loginAction(initialActionState, form({ email: "nadia@exemple.test", password: "motdepasse-123" }));
    expect(r).toEqual({ ok: false, error: "Trop d'essais. Réessayez dans 10 minutes." });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(hitRateLimits.mock.calls[0]![0]).toEqual([
      ["login:ip", "203.0.113.7"],
      ["login:compte", "nadia@exemple.test"],
    ]);
    expect(JSON.stringify(logAudit.mock.calls)).not.toContain("nadia");
  });

  it("journalise un échec de connexion (auth.login_failed) sans email ni mot de passe", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const r = await loginAction(initialActionState, form({ email: "nadia@exemple.test", password: "motdepasse-123" }));
    expect(r).toEqual({ ok: false, error: "Email ou mot de passe incorrect." });
    expect(logAudit.mock.calls[0]![0]).toMatchObject({ action: "auth.login_failed" });
    expect(JSON.stringify(logAudit.mock.calls)).not.toMatch(/nadia|motdepasse/);
  });
});
