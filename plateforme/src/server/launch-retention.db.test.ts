import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * J29 : effacement des comptes jamais confirmés après 7 jours (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/launch-retention.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("purges du lancement (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const { purgeUnverifiedAccounts } = await import("./launch-retention");
  const DOMAIN = "retention-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const old = new Date(Date.now() - 8 * 86_400_000);
  const mk = (k: string, extra: object = {}) =>
    db.user.create({ data: { email: `${k}-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "R", lastName: "T", createdAt: old, ...extra } });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("efface un compte non confirmé de plus de 7 jours ; garde les comptes confirmés, récents et opérateurs", async () => {
    const stale = await mk("vieux");
    const verified = await mk("ok", { emailVerifiedAt: old });
    const recent = await mk("recent", { createdAt: new Date() });
    const op = await mk("op", { role: "OPERATEUR" });
    expect(await purgeUnverifiedAccounts(new Date(), true)).toBeGreaterThanOrEqual(1);
    const left = await db.user.findMany({ where: { id: { in: [stale.id, verified.id, recent.id, op.id] } }, select: { id: true } });
    expect(left.map((u) => u.id).sort()).toEqual([verified.id, recent.id, op.id].sort());
  });

  it("D10 (code M5) : aucune purge sans service d'e-mail ; jamais un accompagnant validé ou en attente, un proche aidant rattaché, une demande de rappel", async () => {
    const noMail = await mk("sans-mail");
    expect(await purgeUnverifiedAccounts(new Date(), false)).toBe(0);
    expect(await db.user.count({ where: { id: noMail.id } })).toBe(1);

    const cg = (k: string, profile: object) =>
      db.user.create({
        data: { email: `${k}-${run}@${DOMAIN}`, passwordHash: "x", role: "ACCOMPAGNANT", firstName: "C", lastName: "T", createdAt: old, caregiverProfile: { create: { allowedLevels: [], communes: [], ...profile } } },
      });
    const valide = await cg("valide", { validation: "VALIDE" });
    const attente = await cg("attente", { validation: "EN_ATTENTE" });
    const rattache = await cg("rattache", { linkedAineId: "aine-inexistant" });
    const brouillon = await cg("brouillon", {});
    const rappel = await mk("rappel");
    await db.planActivationRequest.create({ data: { userId: rappel.id, plan: "SERENITE" } });
    await purgeUnverifiedAccounts(new Date(), true);
    const left = await db.user.findMany({ where: { id: { in: [valide.id, attente.id, rattache.id, brouillon.id, rappel.id, noMail.id] } }, select: { id: true } });
    expect(left.map((u) => u.id).sort()).toEqual([valide.id, attente.id, rattache.id, rappel.id].sort());
  });

  it("D8 (sécu M7) : fiche refusée, en attente depuis plus de 30 jours ou retirée depuis plus de 30 jours → effacée ; preuve gardée au journal", async () => {
    const { purgeAinesWithoutAccord } = await import("./launch-retention");
    const owner = await mk("proprio", { emailVerifiedAt: new Date() });
    const days = (n: number) => new Date(Date.now() - n * 86_400_000);
    const make = (accordEtat: "EN_ATTENTE_ACCORD" | "ACCORD_REFUSE" | "ACCORD_RETIRE" | "ACCORD_RECUEILLI", createdAt: Date, accordAt: Date | null = null) =>
      db.aine.create({
        data: {
          firstName: "A",
          commune: "LAMENTIN",
          latitude: 14.6,
          longitude: -61,
          needs: [],
          activityLevel: 1,
          consentGiven: accordEtat === "ACCORD_RECUEILLI",
          consentByType: "AINE",
          consentByName: "",
          consentAt: createdAt,
          accordEtat,
          accordAt,
          createdAt,
          homeCode: `P${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 6),
          ownerId: owner.id,
        },
      });
    const refusee = await make("ACCORD_REFUSE", days(1), days(1));
    const vieille = await make("EN_ATTENTE_ACCORD", days(31));
    const recente = await make("EN_ATTENTE_ACCORD", days(5));
    const retiree = await make("ACCORD_RETIRE", days(90), days(31));
    const retireeRecente = await make("ACCORD_RETIRE", days(90), days(3));
    const ok = await make("ACCORD_RECUEILLI", days(90), days(80));
    expect(await purgeAinesWithoutAccord()).toBeGreaterThanOrEqual(3);
    const ids = [refusee, vieille, recente, retiree, retireeRecente, ok].map((a) => a.id);
    const left = await db.aine.findMany({ where: { id: { in: ids } }, select: { id: true } });
    expect(left.map((a) => a.id).sort()).toEqual([recente.id, retireeRecente.id, ok.id].sort());
    expect(await db.auditLog.count({ where: { action: "aine.purged_without_accord", entityId: refusee.id } })).toBe(1);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.aine.deleteMany({ where: { id: { in: ids } } });
  });
});
