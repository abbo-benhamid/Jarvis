import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { demandeOrientationSchema, etatVerificationSchema, resultatOrientationSchema } from "@/contracts/v1/accompagnant";

/**
 * L1d (D15) : orientation et demande de vérification depuis l'app (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/accompagnant/verification-app.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe("contrat v1 accompagnant (D15)", () => {
  const ok = { activity: "LIEN", paid: false, existingStatus: "AUCUN", situations: ["RETRAITE"], familyLink: "AUCUN" };
  it("orientation : clés du site, .strict()", () => {
    expect(demandeOrientationSchema.safeParse(ok).success).toBe(true);
    expect(demandeOrientationSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(demandeOrientationSchema.safeParse({ ...ok, activity: "AUTRE" }).success).toBe(false);
    expect(demandeOrientationSchema.safeParse({ ...ok, situations: undefined }).success).toBe(false);
  });
});

describe.runIf(enabled)("vérification de l'accompagnant depuis l'app (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const svc = await import("./verification-app");
  const { caregiverCallReason, listCaregiversToCall } = await import("@/server/operateur/files-lancement");
  const DOMAIN = "verif-app-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const u = await db.user.create({
    data: { email: `g-${run}@${DOMAIN}`, passwordHash: "x", role: "ACCOMPAGNANT", firstName: "Ginette", lastName: "T", caregiverProfile: { create: { allowedLevels: [], communes: ["LAMENTIN"], birthDate: new Date("1980-01-01") } } },
  });
  const actor = { id: u.id, role: "ACCOMPAGNANT" as const, firstName: "Ginette" };

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorId: u.id } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("avant l'orientation : rien de fait, rien à demander", async () => {
    const etat = etatVerificationSchema.parse(await svc.getVerificationState(u.id));
    expect(etat).toMatchObject({ validation: "BROUILLON", orientation: null, manque: [], peutDemander: false });
    expect(etat.etapes.map((e) => [e.code, e.faite])).toEqual([["ORIENTATION", false], ["PROFIL", false], ["PIECES", false], ["DEMANDE", false], ["APPEL_EQUIPE", false]]);
    await expect(svc.requestVerificationFromApp(actor)).rejects.toMatchObject({ code: "INVALIDE" });
  });

  it("orientation par l'app : même résultat que le site ; manque = éléments du site ; la file opérateur la voit", async () => {
    const r = resultatOrientationSchema.parse(await svc.saveOrientationFromApp(actor, { activity: "LIEN", paid: false, existingStatus: "AUCUN", situations: ["RETRAITE", "RETRAITE"], familyLink: "AUCUN" }));
    expect(r).toMatchObject({ issue: "RECOMMANDE", statut: "BENEVOLE_ASSO" });
    const etat = etatVerificationSchema.parse(await svc.getVerificationState(u.id));
    expect(etat.orientation?.issue).toBe("RECOMMANDE");
    expect(etat.etapes[0]).toMatchObject({ code: "ORIENTATION", faite: true });
    expect(etat.manque.join(" ")).toMatch(/disponibilité.*sur le site/);
    expect(etat.peutDemander).toBe(false);
    // POST /verification avec un profil incomplet → 422 avec ce qui manque.
    await expect(svc.requestVerificationFromApp(actor)).rejects.toMatchObject({ code: "INVALIDE", message: expect.stringMatching(/disponibilité/) });
    const queue = await listCaregiversToCall();
    expect(queue.find((c) => c.user.email === u.email)?.raison).toBe("PROFIL_A_FINIR");
  });

  it("profil complet : la demande part (EN_ATTENTE) ; la file opérateur dit « vérification demandée » ; 409 au second envoi", async () => {
    const p = await db.caregiverProfile.findUniqueOrThrow({ where: { userId: u.id } });
    await db.caregiverProfile.update({ where: { id: p.id }, data: { associationName: "Asso du Lamentin", availabilities: { create: [{ dayOfWeek: 1, slot: "MATIN" }] } } });
    await db.verificationItem.updateMany({ where: { caregiverId: p.id }, data: { status: "DECLARE" } });
    const before = etatVerificationSchema.parse(await svc.getVerificationState(u.id));
    expect(before).toMatchObject({ manque: [], peutDemander: true });
    const etat = etatVerificationSchema.parse(await svc.requestVerificationFromApp(actor));
    expect(etat).toMatchObject({ validation: "EN_ATTENTE", peutDemander: false });
    expect(etat.etapes.find((e) => e.code === "DEMANDE")?.faite).toBe(true);
    expect((await listCaregiversToCall()).find((c) => c.user.email === u.email)?.raison).toBe("DEMANDE_ENVOYEE");
    await expect(svc.requestVerificationFromApp(actor)).rejects.toMatchObject({ code: "CONFLIT" });
    expect(await db.auditLog.count({ where: { actorId: u.id, action: "caregiver.submitted" } })).toBe(1);
  });

  it("raison d'appel (pur) : sans orientation depuis 48 h ; rien pour un profil validé", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(caregiverCallReason({ validation: "BROUILLON", status: null, createdAt: new Date("2026-10-06T11:00:00Z") }, now)).toBe("SANS_SUITE");
    expect(caregiverCallReason({ validation: "BROUILLON", status: null, createdAt: new Date("2026-10-07T12:00:00Z") }, now)).toBeNull();
    expect(caregiverCallReason({ validation: "VALIDE", status: "BENEVOLE_ASSO", createdAt: now }, now)).toBeNull();
  });
});
