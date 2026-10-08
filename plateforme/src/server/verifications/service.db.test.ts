import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { dossierVerificationSchema } from "@/contracts/v1/verifications";

/**
 * L2 : vérification de l'accompagnant sur une base réelle (opt-in), adaptateurs SIMULÉS (aucun appel réseau) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/verifications/service.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("vérification L2 (base réelle, adaptateurs simulés)", async () => {
  process.env.KOUDMEN_MODE = "essai";
  process.env.RATE_LIMIT_DISABLED = "true";
  const { db } = await import("@/server/db");
  const svc = await import("./service");
  const acc = await import("@/server/accompagnant/service");
  const review = await import("./review");
  const { SIMULATED_SIRETS } = await import("@/server/adapters/registry");
  const DOMAIN = "verif-l2-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  let n = 0;
  async function caregiver(status: "SALARIE_FAMILLE_CESU" | "AUTO_ENTREPRENEUR_SAP", firstName = "Josiane", lastName = "Bellemare") {
    n += 1;
    const u = await db.user.create({
      data: {
        email: `c${n}-${run}@${DOMAIN}`,
        passwordHash: "x",
        role: "ACCOMPAGNANT",
        firstName,
        lastName,
        caregiverProfile: {
          create: {
            allowedLevels: [1, 2],
            communes: ["LAMENTIN"],
            birthDate: new Date("1980-04-12"),
            hourlyRateCents: 1500,
            availabilities: { create: [{ dayOfWeek: 1, slot: "MATIN" }] },
          },
        },
      },
    });
    const actor = { id: u.id, role: "ACCOMPAGNANT" as const, firstName };
    const answers =
      status === "AUTO_ENTREPRENEUR_SAP"
        ? { activity: "COUPS_DE_MAIN" as const, paid: true, existingStatus: "AUTO_ENTREPRENEUR_SAP" as const, situations: [], familyLink: "AUCUN" as const }
        : { activity: "COUPS_DE_MAIN" as const, paid: true, existingStatus: "AUCUN" as const, situations: [], familyLink: "AUCUN" as const };
    await acc.saveOrientation(actor, answers);
    return { u, actor };
  }
  const ops = await Promise.all(
    [1, 2].map((i) => db.user.create({ data: { email: `op${i}-${run}@${DOMAIN}`, passwordHash: "x", role: "OPERATEUR", firstName: `Op${i}`, lastName: "T" } })),
  );
  const op1 = { id: ops[0]!.id, role: "OPERATEUR" as const };
  const op2 = { id: ops[1]!.id, role: "OPERATEUR" as const };

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users.map((x) => x.id) } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("orientation : éléments L2 créés selon le statut ; le dossier liste ce qui manque", async () => {
    const { u } = await caregiver("SALARIE_FAMILLE_CESU");
    const d = dossierVerificationSchema.parse(await svc.getDossier(u.id));
    expect(d.items.map((i) => i.type).slice(0, 3)).toEqual(["TELEPHONE", "IDENTITE", "ADRESSE"]);
    expect(d.items.find((i) => i.type === "ADRESSE")?.actionSuivante).toBe("SAISIR_ADRESSE");
    expect(d.peutSoumettre).toBe(false);
    expect(d.manque.join(" ")).toMatch(/Numéro de téléphone/);
  });

  it("téléphone : préfixe refusé, code faux puis bon (code simulé 000000), un numéro = un compte", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU");
    await expect(svc.sendPhoneCode(a.actor, { telephone: "+1 212 555 0100", canal: "SMS" }, "1.1.1.1")).rejects.toMatchObject({ code: "PREFIXE_NON_ACCEPTE" });
    await expect(svc.sendPhoneCode(a.actor, { telephone: "0596 12 34 56", canal: "SMS" }, "1.1.1.1")).rejects.toMatchObject({ code: "ACTION_IMPOSSIBLE" });
    const phone = `0696 ${String(Date.now()).slice(-6, -4)} ${String(Date.now()).slice(-4, -2)} ${String(Date.now()).slice(-2)}`;
    const c = await svc.sendPhoneCode(a.actor, { telephone: phone, canal: "SMS" }, "1.1.1.1");
    expect(c.appelPossible).toBe(false);
    await expect(svc.sendPhoneCode(a.actor, { telephone: phone, canal: "SMS" }, "1.1.1.1")).rejects.toMatchObject({ code: "TROP_DE_REQUETES" });
    await expect(svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "123456" })).rejects.toMatchObject({ code: "CODE_FAUX", message: expect.stringMatching(/4 essais/) });
    const r = await svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "000000" });
    expect(r.etat).toBe("VALIDE");
    const row = await db.phoneChallenge.findUniqueOrThrow({ where: { id: c.challengeId } });
    expect(row.codeHash).not.toContain("000000");
    // Un second compte ne peut pas prendre ce numéro.
    const b = await caregiver("SALARIE_FAMILLE_CESU", "Marie");
    await expect(svc.sendPhoneCode(b.actor, { telephone: phone, canal: "SMS" }, "1.1.1.2")).rejects.toMatchObject({ code: "NUMERO_DEJA_UTILISE" });
  });

  it("téléphone : 5 essais faux annulent le code ; code expiré", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU");
    const c = await svc.sendPhoneCode(a.actor, { telephone: `0697 11 ${String(n).padStart(2, "0")} ${String(Date.now()).slice(-2)}`, canal: "SMS" }, "1.1.1.3");
    for (let i = 0; i < 4; i++) await expect(svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "111111" })).rejects.toMatchObject({ code: "CODE_FAUX" });
    await expect(svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "111111" })).rejects.toMatchObject({ code: "TROP_D_ESSAIS" });
    await expect(svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "000000" })).rejects.toMatchObject({ code: "CODE_EXPIRE" });
    const c2 = await svc.sendPhoneCode(a.actor, { telephone: `0697 22 ${String(n).padStart(2, "0")} ${String(Date.now()).slice(-2)}`, canal: "SMS" }, "1.1.1.3");
    await db.phoneChallenge.update({ where: { id: c2.challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(svc.confirmPhoneCode(a.actor, { challengeId: c2.challengeId, code: "000000" })).rejects.toMatchObject({ code: "CODE_EXPIRE" });
  });

  it("identité : webhook simulé signé ; approuvé → VALIDE + nom de référence ; nom différent → A_REVOIR ; doublon ignoré", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU");
    await expect(svc.createIdentitySession(a.actor, { plateforme: "app", consentementBiometrie: true })).resolves.toMatchObject({ retour: "koudmen://verification/retour" });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    const s = await svc.simulateIdentityDecision(check.providerSessionId, "APPROUVE");
    expect(s?.returnUrl).toBe("koudmen://verification/retour");
    const p = await db.caregiverProfile.findUniqueOrThrow({ where: { userId: a.u.id }, include: { verifications: true } });
    expect(p.verifications.find((v) => v.type === "IDENTITE")).toMatchObject({ status: "VALIDE", method: "AUTO_PRESTATAIRE" });
    expect(p.verifiedFamilyName).toBe("Bellemare");
    const decided = await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } });
    expect(decided).toMatchObject({ outcome: "APPROUVE", nameMatch: true, birthDateMatch: true, documentNumberLast4: "0000" });

    const b = await caregiver("SALARIE_FAMILLE_CESU", "Lucie");
    await svc.createIdentitySession(b.actor, { plateforme: "web", consentementBiometrie: true });
    const cb = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: b.u.id } } } });
    await svc.simulateIdentityDecision(cb.providerSessionId, "NOM_DIFFERENT");
    const item = await db.verificationItem.findFirstOrThrow({ where: { caregiver: { userId: b.u.id }, type: "IDENTITE" } });
    expect(item).toMatchObject({ status: "A_REVOIR", decisionCode: "NOM_DIFFERENT" });

    // Refus du prestataire : jamais REFUSE.
    const c = await caregiver("SALARIE_FAMILLE_CESU", "Paul");
    await svc.createIdentitySession(c.actor, { plateforme: "web", consentementBiometrie: true });
    const cc = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: c.u.id } } } });
    await svc.simulateIdentityDecision(cc.providerSessionId, "REFUSE");
    expect((await db.verificationItem.findFirstOrThrow({ where: { caregiver: { userId: c.u.id }, type: "IDENTITE" } })).status).toBe("A_REVOIR");
  });

  it("identité : signature fausse refusée (401), session inconnue ignorée", async () => {
    const r = await svc.processIdentityWebhook("simule", "{}", new Headers({ "x-koudmen-signature": "0", "x-koudmen-timestamp": String(Math.floor(Date.now() / 1000)) }));
    expect(r).toEqual({ status: 401, result: "SIGNATURE_REFUSEE" });
    const { buildSimulatedWebhook } = await import("@/server/adapters/identity/simule");
    const w = buildSimulatedWebhook({ sessionId: "sim_inconnueinconnue", scenario: "APPROUVE", person: { givenNames: "A", familyName: "B", birthDate: null } });
    expect(await svc.processIdentityWebhook("simule", w.rawBody, w.headers)).toEqual({ status: 200, result: "SESSION_INCONNUE" });
    expect(await svc.processIdentityWebhook("simule", w.rawBody, w.headers)).toEqual({ status: 200, result: "DOUBLON" });
  });

  it("entreprise : actif et nom conforme → VALIDE ; siège = adresse → adresse VALIDE ; nom caché → document ; cessé → A_REVOIR", async () => {
    const a = await caregiver("AUTO_ENTREPRENEUR_SAP");
    await svc.saveDeclaredAddress(a.actor, { ligne: "12 rue des Flamboyants", codePostal: "97232", commune: "Le Lamentin" });
    const siret = `9200000${String(n).padStart(3, "0")}0000`;
    // SIRET valide (Luhn) quelconque : le registre simulé le trouve actif.
    const { siretChecksumOk } = await import("./siret");
    let valid = siret;
    for (let k = 0; k < 10 && !siretChecksumOk(valid); k++) valid = `${siret.slice(0, 13)}${k}`;
    const r = await svc.checkCompany(a.actor, { siret: valid });
    expect(r).toMatchObject({ etat: "VALIDE", actif: true, nomConforme: true, adresseSiegeConforme: true, documentRequis: false });
    const items = await db.verificationItem.findMany({ where: { caregiver: { userId: a.u.id } } });
    expect(items.find((i) => i.type === "ADRESSE")).toMatchObject({ status: "VALIDE", method: "AUTO_REGISTRE" });

    const b = await caregiver("AUTO_ENTREPRENEUR_SAP", "Rose");
    expect(await svc.checkCompany(b.actor, { siret: SIMULATED_SIRETS.NOM_CACHE })).toMatchObject({ etat: "A_FOURNIR", documentRequis: true, nomConforme: null });
    const c = await caregiver("AUTO_ENTREPRENEUR_SAP", "Jean");
    expect(await svc.checkCompany(c.actor, { siret: SIMULATED_SIRETS.CESSE })).toMatchObject({ etat: "A_REVOIR", actif: false });
    await expect(svc.checkCompany(c.actor, { siret: "12345678901234" })).rejects.toMatchObject({ code: "ACTION_IMPOSSIBLE" });
    // Un SIRET = un compte.
    const d = await caregiver("AUTO_ENTREPRENEUR_SAP", "Luc");
    await expect(svc.checkCompany(d.actor, { siret: valid })).rejects.toMatchObject({ code: "NUMERO_DEJA_UTILISE" });
  });

  it("document : type réel contrôlé, chiffré en base, revue opérateur avec motif journalisé, complément puis validation", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Odile");
    await expect(svc.uploadDocument(a.actor, { type: "JUSTIFICATIF_DOMICILE", bytes: Buffer.from("%PDF-1.4 x") })).rejects.toMatchObject({ message: expect.stringMatching(/adresse/) });
    await svc.saveDeclaredAddress(a.actor, { ligne: "3 chemin du Morne", codePostal: "97200", commune: "Fort-de-France" });
    await expect(svc.uploadDocument(a.actor, { type: "JUSTIFICATIF_DOMICILE", bytes: Buffer.from("<html>") })).rejects.toMatchObject({ code: "TYPE_NON_ACCEPTE" });
    const up = await svc.uploadDocument(a.actor, { type: "JUSTIFICATIF_DOMICILE", bytes: Buffer.from("%PDF-1.4 facture EDF fictive") });
    const row = await db.sensitiveDocument.findUniqueOrThrow({ where: { id: up.documentId } });
    expect(Buffer.from(row.ciphertext!).includes(Buffer.from("facture"))).toBe(false);
    const item = await db.verificationItem.findFirstOrThrow({ where: { caregiver: { userId: a.u.id }, type: "ADRESSE" } });
    expect(item.status).toBe("EN_COURS");

    const opened = await review.openDocumentForReview(op1, up.documentId, "REVUE_DOSSIER");
    expect(opened?.bytes.toString()).toBe("%PDF-1.4 facture EDF fictive");
    expect(await db.documentAccessLog.count({ where: { documentId: up.documentId, operatorId: op1.id, reason: "REVUE_DOSSIER" } })).toBe(1);

    // Complément : motif fermé, fichier effacé à J+30.
    await review.decideItem(op1, { itemId: item.id, decision: "COMPLEMENT", motif: "TROP_ANCIEN", cases: [] });
    const after = await db.verificationItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after).toMatchObject({ status: "A_FOURNIR", decisionCode: "TROP_ANCIEN" });
    const doc = await db.sensitiveDocument.findUniqueOrThrow({ where: { id: up.documentId } });
    expect(doc.deleteAfter!.getTime() - doc.decidedAt!.getTime()).toBe(30 * 86_400_000);

    // Nouveau document, puis validation avec toutes les cases.
    const up2 = await svc.uploadDocument(a.actor, { type: "JUSTIFICATIF_DOMICILE", bytes: Buffer.from("%PDF-1.4 avis d'impot fictif") });
    await expect(review.decideItem(op1, { itemId: item.id, decision: "VALIDE", motif: null, cases: ["NOM_CONFORME"] })).rejects.toMatchObject({ message: expect.stringMatching(/cases/) });
    await review.decideItem(op1, { itemId: item.id, decision: "VALIDE", motif: null, cases: ["NOM_CONFORME", "ADRESSE_CONFORME", "MOINS_DE_3_MOIS", "TYPE_ACCEPTE", "SANS_RETOUCHE"] });
    expect((await db.verificationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("VALIDE");

    // Purge : fichier effacé après la date, ligne gardée comme preuve.
    await db.sensitiveDocument.update({ where: { id: up2.documentId }, data: { deleteAfter: new Date(Date.now() - 1000) } });
    const purged = await review.purgeVerificationData(new Date());
    expect(purged.documents).toBeGreaterThanOrEqual(1);
    const gone = await db.sensitiveDocument.findUniqueOrThrow({ where: { id: up2.documentId } });
    expect(gone.ciphertext).toBeNull();
    expect(gone.deletedAt).not.toBeNull();
  });

  it("refus : jamais par un seul opérateur ; second avis d'un autre opérateur ; validation bloquée tant qu'un élément manque", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Hélène");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    await svc.simulateIdentityDecision(check.providerSessionId, "REFUSE");
    const item = await db.verificationItem.findFirstOrThrow({ where: { caregiver: { userId: a.u.id }, type: "IDENTITE" } });
    await review.decideItem(op1, { itemId: item.id, decision: "REFUSE", motif: "DOCUMENT_FRAUDULEUX", cases: [] });
    expect((await db.verificationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("A_REVOIR");
    await expect(review.decideItem(op1, { itemId: item.id, decision: "CONFIRMER_REFUS", motif: null, cases: [] })).rejects.toMatchObject({ message: expect.stringMatching(/autre opérateur/) });
    await review.decideItem(op2, { itemId: item.id, decision: "CONFIRMER_REFUS", motif: null, cases: [] });
    expect(await db.verificationItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: "REFUSE", decisionCode: "DOCUMENT_FRAUDULEUX" });

    const { blockersFor } = review;
    const p = await db.caregiverProfile.findUniqueOrThrow({ where: { userId: a.u.id }, include: { verifications: true, user: true } });
    expect((await blockersFor(p.id)).join(" ")).toMatch(/Numéro de téléphone/);
  });

  it("purge : codes de plus de 24 h effacés ; élément expiré → dossier EXPIRE", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Yvette");
    const p = await db.caregiverProfile.findUniqueOrThrow({ where: { userId: a.u.id }, include: { verifications: true } });
    await db.verificationItem.updateMany({ where: { caregiverId: p.id }, data: { status: "VALIDE" } });
    await db.verificationItem.updateMany({ where: { caregiverId: p.id, type: "CASIER_B3" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await db.caregiverProfile.update({ where: { id: p.id }, data: { validation: "VALIDE" } });
    await review.purgeVerificationData(new Date());
    expect((await db.caregiverProfile.findUniqueOrThrow({ where: { id: p.id } })).validation).toBe("EXPIRE");
  });
});
