import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * L1d (D14, D11) : accord à 3 réponses + personne désignée (interface F2, base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/operateur/accord-l1d.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("accord à 3 réponses (L1d, base réelle)", async () => {
  const { db } = await import("@/server/db");
  const { accordL1dSchema, recordElderAccordL1d } = await import("./accord-l1d");
  const DOMAIN = "accord-l1d-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const payeur = await db.user.create({ data: { email: `p-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "Céline", lastName: "A" } });
  const fils = await db.user.create({ data: { email: `s-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "Marc", lastName: "A" } });
  const op = await db.user.create({ data: { email: `o-${run}@${DOMAIN}`, passwordHash: "x", role: "OPERATEUR", firstName: "O", lastName: "A" } });
  const aine = await db.aine.create({
    data: {
      firstName: "Odette",
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
      homeCode: `B${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 6),
      ownerId: payeur.id,
      members: { create: [{ userId: payeur.id, relation: "fille", isPayer: true }, { userId: fils.id, relation: "fils" }] },
    },
  });
  const base = { aineId: aine.id, appelLe: "2026-10-07T10:30", qui: "AINE", langue: "FR" };

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: aine.id } });
    await db.aine.deleteMany({ where: { owner: { email: { endsWith: `@${DOMAIN}` } } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("B2 : aucune réponse par défaut ; « qui » et la mesure de protection sont obligatoires (sauf rappel)", () => {
    const noAnswer = accordL1dSchema.safeParse({ ...base, situationJuridique: "AUCUNE" });
    expect(noAnswer.success).toBe(false);
    expect(noAnswer.error?.flatten().fieldErrors.resultat).toEqual(["Choisissez la réponse de l'aîné."]);
    expect(accordL1dSchema.safeParse({ ...base, qui: undefined, resultat: "REFUS", situationJuridique: "AUCUNE" }).success).toBe(false);
    expect(accordL1dSchema.safeParse({ ...base, resultat: "REFUS", situationJuridique: "" }).success).toBe(false);
    expect(accordL1dSchema.safeParse({ ...base, resultat: "RAPPELER" }).success).toBe(true);
  });

  it("« rappeler plus tard » : la fiche reste en attente, une trace est journalisée", async () => {
    expect(await recordElderAccordL1d(op, accordL1dSchema.parse({ ...base, resultat: "RAPPELER" }))).toEqual({ ok: true });
    expect((await db.aine.findUniqueOrThrow({ where: { id: aine.id } })).accordEtat).toBe("EN_ATTENTE_ACCORD");
    expect(await db.auditLog.count({ where: { entityId: aine.id, action: "aine.accord_rappel" } })).toBe(1);
  });

  it("D11 : la personne désignée par l'aîné est enregistrée avec l'accord ; un inconnu est refusé", async () => {
    const intrus = await recordElderAccordL1d(
      op,
      accordL1dSchema.parse({ ...base, resultat: "ACCORD", noticeLue: "on", situationJuridique: "AUCUNE", personneDesignee: op.id }),
    );
    expect(intrus.ok).toBe(false);
    const v = accordL1dSchema.parse({ ...base, resultat: "ACCORD", noticeLue: "on", situationJuridique: "AUCUNE", personneDesignee: fils.id });
    expect(await recordElderAccordL1d(op, v)).toEqual({ ok: true });
    expect(await db.aine.findUniqueOrThrow({ where: { id: aine.id } })).toMatchObject({ accordEtat: "ACCORD_RECUEILLI", tripViewerId: fils.id });
  });
});
