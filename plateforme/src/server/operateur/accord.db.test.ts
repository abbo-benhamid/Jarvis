import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * R5 (J5) : accord de l'aîné enregistré par un conseiller (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/operateur/accord.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("accord de l'aîné (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const { accordSchema, recordElderAccord } = await import("./accord");
  const DOMAIN = "accord-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const famille = await db.user.create({ data: { email: `f-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "F", lastName: "A" } });
  const op = await db.user.create({ data: { email: `o-${run}@${DOMAIN}`, passwordHash: "x", role: "OPERATEUR", firstName: "O", lastName: "A" } });
  const aine = await db.aine.create({
    data: {
      firstName: "Léonie",
      commune: "FORT_DE_FRANCE",
      latitude: 14.6,
      longitude: -61.07,
      phone: "+596 596 00 00 00",
      needs: [],
      activityLevel: 1,
      consentGiven: false,
      consentByType: "AINE",
      consentByName: "",
      consentAt: new Date(),
      homeCode: `A${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 6),
      ownerId: famille.id,
    },
  });
  const base = { aineId: aine.id, appelLe: "2026-10-07T10:30", qui: "AINE", langue: "GCF", situationJuridique: "AUCUNE" };

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: aine.id } });
    await db.aine.deleteMany({ where: { owner: { email: { endsWith: `@${DOMAIN}` } } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("nouvel aîné : EN_ATTENTE_ACCORD par défaut", () => {
    expect(aine.accordEtat).toBe("EN_ATTENTE_ACCORD");
  });

  it("refuse un accord sans notice lue, un représentant sans nom, une tutelle sans « jugement vu le »", () => {
    expect(accordSchema.safeParse({ ...base, resultat: "ACCORD" }).success).toBe(false);
    expect(accordSchema.safeParse({ ...base, resultat: "ACCORD", noticeLue: "on", qui: "REPRESENTANT" }).success).toBe(false);
    expect(accordSchema.safeParse({ ...base, resultat: "ACCORD", noticeLue: "on", situationJuridique: "TUTELLE" }).success).toBe(false);
    expect(accordSchema.safeParse({ ...base, resultat: "REFUS" }).success).toBe(true);
  });

  it("enregistre l'accord (heure de Martinique, notice, langue), journal sans nom", async () => {
    const v = accordSchema.parse({ ...base, resultat: "ACCORD", noticeLue: "on" });
    expect(await recordElderAccord(op, v)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: aine.id } });
    expect(after).toMatchObject({ accordEtat: "ACCORD_RECUEILLI", accordLangue: "GCF", accordNoticeVersion: "FALC-2026-10", consentGiven: true, accordRecordedById: op.id });
    expect(after.accordAt!.toISOString()).toBe("2026-10-07T14:30:00.000Z");
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: aine.id, action: "aine.accord_recorded" } });
    expect(JSON.stringify(log.metadata)).not.toContain("Léonie");
    // Un second accord est refusé ; seul le retrait reste possible.
    expect(await recordElderAccord(op, v)).toMatchObject({ ok: false });
  });

  it("retrait de l'accord : le profil passe ACCORD_RETIRE", async () => {
    const v = accordSchema.parse({ ...base, resultat: "RETRAIT", qui: "REPRESENTANT", nomRepresentant: "Patrick B., tuteur", situationJuridique: "TUTELLE", justificatifVuLe: "2026-10-01" });
    expect(await recordElderAccord(op, v)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: aine.id } });
    expect(after).toMatchObject({ accordEtat: "ACCORD_RETIRE", consentGiven: false, situationJuridique: "TUTELLE" });
  });
});
