import { afterAll, describe, expect, it } from "vitest";

/**
 * Durées de conservation (M6) sur une VRAIE base (opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/sandbox/retention.db.test.ts
 * Le test utilise un code testeur propre et une date « maintenant » dans le futur proche pour ne cibler que SES lignes
 * (les lignes des autres tests sont plus récentes que les dates utilisées).
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

describe.runIf(enabled)("purge des durées de conservation", async () => {
  const { db } = await import("@/server/db");
  const purge = await import("./purge");
  const code = `RETENTION-${Date.now()}`;
  const old = new Date("2001-01-10T12:00:00Z");

  afterAll(async () => {
    await db.discoveryRequest.deleteMany({ where: { testerCode: code } });
    await db.feedback.deleteMany({ where: { testerCode: code } });
    await db.usageEvent.deleteMany({ where: { testerCode: code } });
    await db.microAnswer.deleteMany({ where: { testerCode: code } });
    await db.$disconnect();
  });

  it("efface les visites découverte de plus de 6 mois, et avis/mesures seulement après fin du test + 6 mois", async () => {
    const consent = { name: "Test", contact: "test@exemple.test", consentText: "x", testerCode: code };
    await db.discoveryRequest.create({ data: { ...consent, consentAt: old, createdAt: old } });
    await db.discoveryRequest.create({ data: { ...consent, consentAt: new Date("2001-06-01T00:00:00Z"), createdAt: new Date("2001-06-01T00:00:00Z") } });
    await db.feedback.create({ data: { rating: 4, message: "avis", pagePath: "/", testerCode: code, createdAt: old } });
    await db.usageEvent.create({ data: { name: "page.view", path: "/", testerCode: code, createdAt: old } });
    await db.microAnswer.create({ data: { userId: `u-${code}`, questionKey: "KAYE_RASSURE", answer: "5", testerCode: code, createdAt: old } });

    // « Maintenant » = 2001-08-01 ; fin du test le 2001-03-31 → avis et mesures gardés jusqu'au 2001-09-30.
    const now = new Date("2001-08-01T00:00:00Z");
    const testEnd = purge.parseTestEndDate("2001-03-31");
    const r1 = await purge.purgeRetention(db, now, testEnd);
    expect(r1.discoveries).toBeGreaterThanOrEqual(1);
    expect(await db.discoveryRequest.count({ where: { testerCode: code } })).toBe(1); // celle de juin reste (< 6 mois)
    expect(r1.feedbacks + r1.usageEvents + r1.microAnswers).toBe(0);
    expect(await db.feedback.count({ where: { testerCode: code } })).toBe(1);

    // Sans date de fin : avis et mesures ne sont jamais effacés automatiquement.
    const r2 = await purge.purgeRetention(db, new Date("2001-10-02T00:00:00Z"), null);
    expect(r2.feedbacks).toBe(0);

    // Après fin du test + 6 mois : tout est effacé.
    const r3 = await purge.purgeRetention(db, new Date("2001-10-02T00:00:00Z"), testEnd);
    expect(r3.feedbacks).toBeGreaterThanOrEqual(1);
    expect(await db.feedback.count({ where: { testerCode: code } })).toBe(0);
    expect(await db.usageEvent.count({ where: { testerCode: code } })).toBe(0);
    expect(await db.microAnswer.count({ where: { testerCode: code } })).toBe(0);
  });
});
