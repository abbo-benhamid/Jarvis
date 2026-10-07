import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * L4 / R8 : demandes de rappel (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/offre/activation.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("demandes de rappel (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const act = await import("./activation");
  const DOMAIN = "activation-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const make = (role: "FAMILLE" | "ACCOMPAGNANT" | "OPERATEUR") =>
    db.user.create({ data: { email: `${role.toLowerCase()}-${run}@${DOMAIN}`, passwordHash: "x", role, firstName: "T", lastName: "Rappel" } });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
    await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db.$disconnect();
  });

  it("famille : une demande sans aîné (préinscription), sans doublon, sans paiement", async () => {
    const f = await make("FAMILLE");
    const a = await act.requestActivation(f, { plan: "KOZE", aineId: null });
    const b = await act.requestActivation(f, { plan: "KOZE", aineId: null });
    expect(a.created).toBe(true);
    expect(b).toEqual({ created: false, id: a.id });
    expect(await db.planActivationRequest.count({ where: { userId: f.id } })).toBe(1);
    expect(await db.simulatedPayment.count({ where: { subscription: { payerId: f.id } } })).toBe(0);
    await expect(act.requestActivation(f, { plan: "LAKOU", aineId: null })).rejects.toThrow("gratuite");
  });

  it("R6 (J27) : un accompagnant ne demande jamais de formule payante", async () => {
    const c = await make("ACCOMPAGNANT");
    await expect(act.requestActivation(c, { plan: "SERENITE", aineId: null })).rejects.toBeInstanceOf(act.ActivationError);
    expect(await db.planActivationRequest.count({ where: { userId: c.id } })).toBe(0);
  });

  it("le conseiller note l'appel puis clôt ; une demande close ne bouge plus", async () => {
    const f = await db.user.findFirstOrThrow({ where: { email: `famille-${run}@${DOMAIN}` } });
    const op = await make("OPERATEUR");
    const req = await db.planActivationRequest.findFirstOrThrow({ where: { userId: f.id } });
    expect(await act.handleActivation(op, req.id, "RAPPELEE")).toBe(true);
    expect(await act.handleActivation(op, req.id, "CLOSE")).toBe(true);
    expect(await act.handleActivation(op, req.id, "RAPPELEE")).toBe(false);
    expect((await db.planActivationRequest.findUniqueOrThrow({ where: { id: req.id } })).handledById).toBe(op.id);
  });

  it("J35 : purge des demandes sans suite après 3 mois", async () => {
    const f = await db.user.findFirstOrThrow({ where: { email: `famille-${run}@${DOMAIN}` } });
    const old = await db.planActivationRequest.create({ data: { userId: f.id, plan: "SERENITE" } });
    await db.$executeRaw`UPDATE "PlanActivationRequest" SET "updatedAt" = now() - interval '4 months' WHERE id = ${old.id}`;
    expect(await act.purgeActivations()).toBeGreaterThanOrEqual(1);
    expect(await db.planActivationRequest.findUnique({ where: { id: old.id } })).toBeNull();
  });
});
