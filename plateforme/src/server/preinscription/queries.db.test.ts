import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * P1 : rang sur la liste d'ouverture (familles) et dans la file de validation (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/preinscription/queries.db.test.ts
 * Les rangs sont RELATIFS : la base peut contenir d'autres comptes (on compare les écarts).
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

describe.runIf(enabled)("préinscription : rangs (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const q = await import("./queries");
  const DOMAIN = "p1-rang-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const t0 = new Date(Date.now() + 365 * 86_400_000); // dans le futur : ces comptes sont les derniers de la liste.
  const fam = (n: number, extra: Record<string, unknown> = {}) =>
    db.user.create({
      data: { email: `f${n}-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "F", lastName: "T", createdAt: new Date(t0.getTime() + n * 1000), ...extra },
    });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { caregiverProfile: { select: { id: true } } } });
    const ids = users.map((u) => u.caregiverProfile?.id).filter((x): x is string => Boolean(x));
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("familles : ordre d'inscription ; démo et accompagnants hors liste", async () => {
    const a = await fam(1);
    const demo = await fam(2, { isDemo: true });
    const b = await fam(3);
    const ra = (await q.rangFamille(a.id))!;
    expect(ra).toBeGreaterThanOrEqual(1);
    expect(await q.rangFamille(b.id)).toBe(ra + 1);
    expect(await q.rangFamille(demo.id)).toBeNull();
  });

  it("accompagnants : rang dans la file EN_ATTENTE, par date de demande ; hors file : null", async () => {
    const mk = (n: number, validation: "EN_ATTENTE" | "BROUILLON") =>
      db.user.create({
        data: {
          email: `g${n}-${run}@${DOMAIN}`,
          passwordHash: "x",
          role: "ACCOMPAGNANT",
          firstName: "G",
          lastName: "T",
          caregiverProfile: { create: { allowedLevels: [], communes: [], validation } },
        },
        include: { caregiverProfile: true },
      });
    const first = await mk(1, "EN_ATTENTE");
    const second = await mk(2, "EN_ATTENTE");
    const draft = await mk(3, "BROUILLON");
    // Demandes dans le futur, la seconde AVANT la première : l'ordre suit la date de la demande, pas la création du compte.
    await db.auditLog.create({ data: { action: "caregiver.submitted", entityType: "CaregiverProfile", entityId: second.caregiverProfile!.id, createdAt: new Date(t0.getTime() + 10_000) } });
    await db.auditLog.create({ data: { action: "caregiver.submitted", entityType: "CaregiverProfile", entityId: first.caregiverProfile!.id, createdAt: new Date(t0.getTime() + 20_000) } });
    const r2 = (await q.rangValidation(second.id))!;
    expect(r2).toBeGreaterThanOrEqual(1);
    expect(await q.rangValidation(first.id)).toBe(r2 + 1);
    expect(await q.rangValidation(draft.id)).toBeNull();
  });
});
