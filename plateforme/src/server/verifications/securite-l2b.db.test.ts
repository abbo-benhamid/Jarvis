import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * L2b : scénarios d'attaque de la revue sécurité L2 (docs/revues/L2-securite.md § 4, S1 à S6), rejoués en tests
 * PERMANENTS, plus les corrections B1, M1 à M7 et les mineurs. Base réelle (opt-in), adaptateurs simulés :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/verifications/securite-l2b.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const DAY = 86_400_000;

describe.runIf(enabled)("L2b : scénarios d'attaque S1 à S6 et corrections (base réelle)", async () => {
  process.env.KOUDMEN_MODE = "essai";
  process.env.RATE_LIMIT_DISABLED = "true";
  const { db } = await import("@/server/db");
  const svc = await import("./service");
  const acc = await import("@/server/accompagnant/service");
  const review = await import("./review");
  const { siretChecksumOk } = await import("./siret");
  const { buildSimulatedWebhook, SimulatedIdentityAdapter } = await import("@/server/adapters/identity/simule");
  const { setIdentityPortForTests } = await import("@/server/adapters/identity");
  const { SimulatedOtpAdapter, setOtpPortForTests } = await import("@/server/adapters/otp");
  const { purgeUnverifiedAccounts } = await import("@/server/launch-retention");
  const { WebhookSignatureError } = await import("@/server/ports/verification");

  const DOMAIN = "securite-l2b-test.koudmen.test";
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
          create: { allowedLevels: [1, 2], communes: ["LAMENTIN"], birthDate: new Date("1980-04-12"), hourlyRateCents: 1500, availabilities: { create: [{ dayOfWeek: 1, slot: "MATIN" }] } },
        },
      },
    });
    const actor = { id: u.id, role: "ACCOMPAGNANT" as const, firstName };
    const existingStatus = status === "AUTO_ENTREPRENEUR_SAP" ? ("AUTO_ENTREPRENEUR_SAP" as const) : ("AUCUN" as const);
    await acc.saveOrientation(actor, { activity: "COUPS_DE_MAIN", paid: true, existingStatus, situations: [], familyLink: "AUCUN" });
    const profile = await db.caregiverProfile.findUniqueOrThrow({ where: { userId: u.id } });
    return { u, actor, profile };
  }
  const item = (userId: string, type: "TELEPHONE" | "IDENTITE" | "ADRESSE" | "ENTREPRISE") => db.verificationItem.findFirstOrThrow({ where: { caregiver: { userId }, type } });
  /** Numéro mobile martiniquais unique pour ce passage. */
  const phone = () => {
    n += 1;
    const d = `${Date.now()}${n}`.slice(-6);
    return `0696 ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)}`;
  };
  function validSiret(seed: number): string {
    const base = `9300${String(seed).padStart(4, "0")}${run.replace(/\D/g, "").padEnd(5, "1").slice(0, 5)}`;
    for (let k = 0; k < 10; k++) if (siretChecksumOk(`${base}${k}`)) return `${base}${k}`;
    throw new Error("SIRET");
  }

  const ops = await Promise.all(
    [1, 2, 3, 4].map((i) => db.user.create({ data: { email: `op${i}-${run}@${DOMAIN}`, passwordHash: "x", role: "OPERATEUR", firstName: `Op${i}`, lastName: "T" } })),
  );
  const [op1, op2, op3, op4] = ops.map((o) => ({ id: o.id, role: "OPERATEUR" as const }));

  /** Refus d'un élément à deux opérateurs (proposé par op1, confirmé par op2). */
  async function refuseTwice(itemId: string, motif = "DOCUMENT_FRAUDULEUX") {
    await review.decideItem(op1!, { itemId, decision: "REFUSE", motif, cases: [] });
    await review.decideItem(op2!, { itemId, decision: "CONFIRMER_REFUS", motif: null, cases: [] });
    expect((await db.verificationItem.findUniqueOrThrow({ where: { id: itemId } })).status).toBe("REFUSE");
  }

  afterEach(() => {
    setIdentityPortForTests("simule", null);
    setOtpPortForTests("SMS", null);
    process.env.KOUDMEN_MODE = "essai";
  });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users.map((x) => x.id) } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  // ─────────────── S6 / B1 : un refus à deux opérateurs ne s'annule pas par l'accompagnant ───────────────

  it("S6 (B1) : téléphone REFUSE à deux opérateurs ; nouveau code (autre numéro) et ancien code : l'état reste REFUSE", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU");
    // Un code demandé AVANT le refus (attaque par course).
    const early = await svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.0.1");
    const tel = await item(a.u.id, "TELEPHONE");
    await refuseTwice(tel.id, "COMPTE_EN_DOUBLE");
    await expect(svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.0.1")).rejects.toMatchObject({ code: "ACTION_IMPOSSIBLE" });
    await expect(svc.confirmPhoneCode(a.actor, { challengeId: early.challengeId, code: "000000" })).rejects.toMatchObject({ code: "ACTION_IMPOSSIBLE" });
    expect((await item(a.u.id, "TELEPHONE")).status).toBe("REFUSE");
    // Même chose pendant une revue (A_REVOIR) : le code ne court-circuite pas l'opérateur.
    const b = await caregiver("SALARIE_FAMILLE_CESU", "Marc");
    const telB = await item(b.u.id, "TELEPHONE");
    const early2 = await svc.sendPhoneCode(b.actor, { telephone: phone(), canal: "SMS" }, "10.0.0.2");
    await review.decideItem(op1!, { itemId: telB.id, decision: "REFUSE", motif: "COMPTE_EN_DOUBLE", cases: [] });
    await expect(svc.confirmPhoneCode(b.actor, { challengeId: early2.challengeId, code: "000000" })).rejects.toBeInstanceOf(svc.VerificationError);
    expect((await item(b.u.id, "TELEPHONE")).status).toBe("A_REVOIR");
  });

  it("B1 : adresse REFUSE (justificatif falsifié) ; adresse = siège Sirene ou SIRET vérifié : l'état reste REFUSE", async () => {
    const a = await caregiver("AUTO_ENTREPRENEUR_SAP", "Rosette");
    const address = { ligne: "8 rue Schoelcher", codePostal: "97232", commune: "Le Lamentin" };
    await svc.saveDeclaredAddress(a.actor, address);
    const adr = await item(a.u.id, "ADRESSE");
    await refuseTwice(adr.id);
    // Le SIRET est vérifié (siège = adresse déclarée) : l'entreprise est VALIDE, l'adresse reste REFUSE.
    const r = await svc.checkCompany(a.actor, { siret: validSiret(n) });
    expect(r).toMatchObject({ etat: "VALIDE", adresseSiegeConforme: true });
    expect((await item(a.u.id, "ADRESSE")).status).toBe("REFUSE");
    // Ressaisir l'adresse du siège : refusé, l'état reste REFUSE.
    await expect(svc.saveDeclaredAddress(a.actor, address)).rejects.toBeInstanceOf(svc.VerificationError);
    expect((await item(a.u.id, "ADRESSE")).status).toBe("REFUSE");
  });

  it("B1 : un recours accepté exige deux opérateurs (hors ceux du refus) pour rouvrir un élément refusé", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Line");
    const tel = await item(a.u.id, "TELEPHONE");
    await refuseTwice(tel.id);
    await db.caregiverProfile.update({ where: { id: a.profile.id }, data: { validation: "REFUSE", refusedAt: new Date(), reviewedById: op2!.id, refusalProposedById: op1!.id, refusalCode: "DOCUMENT_FRAUDULEUX" } });
    const appeal = await svc.createAppeal(a.actor, "NOUVEAU_DOCUMENT");
    await expect(review.decideAppeal(op1!, appeal.recoursId, "ACCEPTE")).rejects.toThrow(/autre opérateur/);
    expect(await review.decideAppeal(op3!, appeal.recoursId, "ACCEPTE")).toMatch(/proposé/);
    expect((await item(a.u.id, "TELEPHONE")).status).toBe("REFUSE");
    await expect(review.decideAppeal(op3!, appeal.recoursId, "ACCEPTE")).rejects.toThrow(/autre opérateur/);
    expect(await review.decideAppeal(op4!, appeal.recoursId, "ACCEPTE")).toMatch(/deux opérateurs/);
    expect((await item(a.u.id, "TELEPHONE")).status).toBe("A_FOURNIR");
    expect((await db.caregiverProfile.findUniqueOrThrow({ where: { id: a.profile.id } })).validation).toBe("BROUILLON");
    // m12 + notification des opérateurs : l'accompagnant et les opérateurs sont prévenus.
    expect(await db.outboxMessage.count({ where: { recipientUserId: a.u.id, template: "RECOURS_DECIDE" } })).toBe(1);
    expect(await db.outboxMessage.count({ where: { recipientUserId: op1!.id, template: "RECOURS_A_TRAITER", relatedId: appeal.recoursId } })).toBeGreaterThanOrEqual(1);
  });

  // ─────────────── S2 / M1 : un seul opérateur ne passe pas outre un refus proposé ───────────────

  it("S2 (M1) : A propose un refus ; B ne peut ni valider, ni demander un complément, ni annuler seul", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Hélène");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    await svc.simulateIdentityDecision(check.providerSessionId, "REFUSE");
    const id = (await item(a.u.id, "IDENTITE")).id;
    const all = ["PIECE_VUE_EN_VISIO", "VISAGE_CONFORME", "NOM_ET_NAISSANCE_CONFORMES"];
    await review.decideItem(op1!, { itemId: id, decision: "REFUSE", motif: "DOCUMENT_FRAUDULEUX", cases: [] });
    await expect(review.decideItem(op2!, { itemId: id, decision: "VALIDE", motif: null, cases: all })).rejects.toThrow(/refus est proposé/);
    await expect(review.decideItem(op2!, { itemId: id, decision: "COMPLEMENT", motif: "ILLISIBLE", cases: [] })).rejects.toThrow(/refus est proposé/);
    expect((await review.blockersFor(a.profile.id)).join(" ")).toMatch(/Refus proposé sur : Identité/);
    // B propose l'annulation : le refus reste proposé ; B ne confirme pas sa propre annulation.
    expect(await review.decideItem(op2!, { itemId: id, decision: "ANNULER_REFUS", motif: null, cases: [] })).toMatch(/annulation du refus proposée/);
    expect((await db.verificationItem.findUniqueOrThrow({ where: { id } })).refusalProposedAt).not.toBeNull();
    await expect(review.decideItem(op2!, { itemId: id, decision: "ANNULER_REFUS", motif: null, cases: [] })).rejects.toThrow(/autre opérateur/);
    await expect(review.decideItem(op2!, { itemId: id, decision: "VALIDE", motif: null, cases: all })).rejects.toThrow(/refus est proposé/);
    expect((await db.verificationItem.findUniqueOrThrow({ where: { id } })).status).toBe("A_REVOIR");
    // Un second opérateur (C) confirme l'annulation : deux personnes sont d'accord. La validation devient possible.
    expect(await review.decideItem(op3!, { itemId: id, decision: "ANNULER_REFUS", motif: null, cases: [] })).toMatch(/deux opérateurs/);
    await review.decideItem(op3!, { itemId: id, decision: "VALIDE", motif: null, cases: all });
    expect((await db.verificationItem.findUniqueOrThrow({ where: { id } })).status).toBe("VALIDE");
  });

  it("M1 : refus de DOSSIER proposé : validation du profil bloquée ; annulation à deux opérateurs", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Gisèle");
    expect((await review.proposeOrConfirmDossierRefusal(op1!, a.profile.id, "DOCUMENT_FRAUDULEUX")).step).toBe("PROPOSE");
    expect((await review.blockersFor(a.profile.id)).join(" ")).toMatch(/refus du profil est proposé/);
    expect(await review.cancelDossierRefusal(op1!, a.profile.id)).toMatch(/proposée/);
    await expect(review.cancelDossierRefusal(op1!, a.profile.id)).rejects.toThrow(/autre opérateur/);
    expect((await db.caregiverProfile.findUniqueOrThrow({ where: { id: a.profile.id } })).refusalProposedAt).not.toBeNull();
    expect(await review.cancelDossierRefusal(op2!, a.profile.id)).toMatch(/deux opérateurs/);
    const p = await db.caregiverProfile.findUniqueOrThrow({ where: { id: a.profile.id } });
    expect(p.refusalProposedAt).toBeNull();
    expect((await review.blockersFor(a.profile.id)).join(" ")).not.toMatch(/refus du profil/);
  });

  // ─────────────── S1 / M2 : une décision tardive du prestataire n'écrase pas une décision humaine ───────────────

  it("S1 (M2) : complément demandé par l'opérateur, puis APPROUVE tardif de la même session : ignoré, gardé en trace", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Félix");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    await svc.simulateIdentityDecision(check.providerSessionId, "NOM_DIFFERENT");
    const id = (await item(a.u.id, "IDENTITE")).id;
    await review.decideItem(op1!, { itemId: id, decision: "COMPLEMENT", motif: "REPRENDRE_PHOTO", cases: [] });
    const late = buildSimulatedWebhook({ sessionId: check.providerSessionId, scenario: "APPROUVE", person: { givenNames: "Félix", familyName: "Bellemare", birthDate: "1980-04-12" } });
    expect(await svc.processIdentityWebhook("simule", late.rawBody, late.headers)).toEqual({ status: 200, result: "IGNORE:SESSION_DEJA_DECIDEE" });
    expect(await db.verificationItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "A_FOURNIR", decisionCode: "REPRENDRE_PHOTO" });
    const after = await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } });
    expect(after.outcome).toBe("APPROUVE"); // le scénario NOM_DIFFERENT est un « approuvé » au mauvais nom
    expect(after.lateOutcomes).toHaveLength(1);
    expect(await db.auditLog.count({ where: { action: "identity.decision_ignoree", entityId: id } })).toBe(1);
  });

  it("M2 : une décision pour une ANCIENNE session, ou un élément en revue humaine, ne change pas l'élément", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Odette");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const [newer, older] = await db.identityCheck.findMany({ where: { verificationItem: { caregiver: { userId: a.u.id } } }, orderBy: { createdAt: "desc" } });
    const w = buildSimulatedWebhook({ sessionId: older!.providerSessionId, scenario: "APPROUVE", person: { givenNames: "Odette", familyName: "Bellemare", birthDate: "1980-04-12" } });
    expect((await svc.processIdentityWebhook("simule", w.rawBody, w.headers)).result).toBe("IGNORE:SESSION_ANCIENNE");
    expect((await item(a.u.id, "IDENTITE")).status).toBe("EN_COURS");
    // L'élément passe en revue humaine (refus proposé) : la décision de la dernière session est gardée, pas appliquée.
    const id = (await item(a.u.id, "IDENTITE")).id;
    await review.decideItem(op1!, { itemId: id, decision: "REFUSE", motif: "IDENTITE_NON_CONFIRMEE", cases: [] });
    const w2 = buildSimulatedWebhook({ sessionId: newer!.providerSessionId, scenario: "APPROUVE", person: { givenNames: "Odette", familyName: "Bellemare", birthDate: "1980-04-12" } });
    expect((await svc.processIdentityWebhook("simule", w2.rawBody, w2.headers)).result).toBe("IGNORE:DECISION_HUMAINE");
    expect((await item(a.u.id, "IDENTITE")).status).toBe("A_REVOIR");
    expect((await db.identityCheck.findUniqueOrThrow({ where: { id: newer!.id } })).decidedAt).not.toBeNull();
  });

  // ─────────────── S4 / M3 : rejeu d'une décision signée après la purge des WebhookEvent ───────────────

  it("S4 (M3) : 1er envoi VALIDE, 2e DOUBLON, 3e après la purge des WebhookEvent : décision déjà appliquée, ignorée", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Yves");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    const w = buildSimulatedWebhook({ sessionId: check.providerSessionId, scenario: "APPROUVE", person: { givenNames: "Yves", familyName: "Bellemare", birthDate: "1980-04-12" } });
    expect((await svc.processIdentityWebhook("simule", w.rawBody, w.headers)).result).toBe("IDENTITE:VALIDE");
    expect((await svc.processIdentityWebhook("simule", w.rawBody, w.headers)).result).toBe("DOUBLON");
    const eventId = (JSON.parse(w.rawBody) as { eventId: string }).eventId;
    // 90 jours plus tard : la purge a effacé la ligne d'idempotence.
    await db.webhookEvent.deleteMany({ where: { provider: "identite:simule", providerEventId: eventId } });
    // Pire cas : l'élément est de nouveau en attente du prestataire (nouvelle session) ; la vieille décision ne s'applique pas.
    const id = (await item(a.u.id, "IDENTITE")).id;
    await db.verificationItem.update({ where: { id }, data: { status: "EN_COURS", validatedWith: null } });
    await db.identityCheck.update({ where: { id: check.id }, data: { outcome: null } });
    expect((await svc.processIdentityWebhook("simule", w.rawBody, w.headers)).result).toBe("IGNORE:DEJA_APPLIQUEE");
    expect((await item(a.u.id, "IDENTITE")).status).toBe("EN_COURS");
    expect((await item(a.u.id, "IDENTITE")).appliedDecisionIds).toContain(`simule:${eventId}`);
  });

  // ─────────────── S5 / M4 : « EN_REVUE » après la décision ───────────────

  it("S5 (M4) : approuvé puis « en revue » (ordre inversé) : decidedAt n'est jamais remis à nul", async () => {
    // Prestataire factice (même chemin que le webhook signé) : l'événement vient du corps.
    const fake = new SimulatedIdentityAdapter();
    fake.parseWebhook = async (raw: string) => {
      const e = JSON.parse(raw) as { id: string; session: string; outcome: "APPROUVE" | "EN_REVUE" };
      if (!e.id) throw new WebhookSignatureError();
      return { providerEventId: e.id, providerSessionId: e.session, outcome: e.outcome, riskCodes: [], verifiedGivenNames: "Iris", verifiedFamilyName: "Bellemare", verifiedBirthDate: "1980-04-12" };
    };
    setIdentityPortForTests("simule", fake);
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Iris");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    const s = check.providerSessionId;
    expect((await svc.processIdentityWebhook("simule", JSON.stringify({ id: `e1-${s}`, session: s, outcome: "APPROUVE" }), new Headers())).result).toBe("IDENTITE:VALIDE");
    const decided = (await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } })).decidedAt;
    expect(decided).not.toBeNull();
    expect((await svc.processIdentityWebhook("simule", JSON.stringify({ id: `e2-${s}`, session: s, outcome: "EN_REVUE" }), new Headers())).result).toBe("IGNORE:SESSION_DEJA_DECIDEE");
    const after = await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } });
    expect(after).toMatchObject({ outcome: "APPROUVE", decidedAt: decided });
    expect((await item(a.u.id, "IDENTITE")).status).toBe("VALIDE");
  });

  // ─────────────── S3 / M4, M5 : justificatif et session abandonnés ───────────────

  it("S3 (M4, M5) : justificatif jamais décidé effacé à 90 jours ; session abandonnée supprimée chez le prestataire", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Mireille");
    await svc.saveDeclaredAddress(a.actor, { ligne: "3 chemin du Morne", codePostal: "97200", commune: "Fort-de-France" });
    const up = await svc.uploadDocument(a.actor, { type: "JUSTIFICATIF_DOMICILE", bytes: Buffer.from("%PDF-1.4 facture fictive") });
    const doc = await db.sensitiveDocument.findUniqueOrThrow({ where: { id: up.documentId } });
    // M5 : la date d'effacement est remplie dès le dépôt (dépôt + 90 jours).
    expect(Math.abs(doc.deleteAfter.getTime() - doc.uploadedAt.getTime() - 90 * DAY)).toBeLessThan(5_000);
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    // Le temps passe (aucun webhook, aucune décision) : on recule les dates de 91 et 40 jours.
    await db.sensitiveDocument.update({ where: { id: doc.id }, data: { uploadedAt: new Date(Date.now() - 91 * DAY), deleteAfter: new Date(Date.now() - DAY) } });
    await db.identityCheck.update({ where: { id: check.id }, data: { createdAt: new Date(Date.now() - 40 * DAY), expiresAt: new Date(Date.now() - 39 * DAY) } });
    const purged = await review.purgeVerificationData(new Date());
    expect(purged.documents).toBeGreaterThanOrEqual(1);
    const gone = await db.sensitiveDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(gone.ciphertext).toBeNull();
    expect(gone.deletedAt).not.toBeNull();
    expect(await item(a.u.id, "ADRESSE")).toMatchObject({ status: "A_FOURNIR", decisionCode: "DOSSIER_INCOMPLET_90J" });
    expect((await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } })).redactRequestedAt).not.toBeNull();
  });

  it("M4 : prestataire muet : échec compté, journalisé, réessayé chaque nuit ; alerte après 3 nuits", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Noël");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    await db.identityCheck.update({ where: { id: check.id }, data: { createdAt: new Date(Date.now() - 60 * DAY), expiresAt: new Date(Date.now() - 59 * DAY), decidedAt: new Date(Date.now() - 50 * DAY), outcome: "APPROUVE" } });
    const mute = new SimulatedIdentityAdapter();
    mute.redact = async () => {
      throw new Error("HTTP 503");
    };
    setIdentityPortForTests("simule", mute);
    const before = await review.redactionFailures();
    for (let night = 1; night <= 3; night++) {
      const r = await review.purgeVerificationData(new Date());
      expect(r.suppressionsEnEchec).toBeGreaterThanOrEqual(1);
      expect((await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } })).redactAttempts).toBe(night);
    }
    expect(await db.auditLog.count({ where: { action: "identity.redact_failed", entityId: check.id } })).toBe(3);
    expect(await review.redactionFailures()).toBe(before + 1);
    expect((await review.listReviewQueue()).redactAlerts).toBeGreaterThanOrEqual(1);
    // Le prestataire répond de nouveau : la suppression part, l'alerte disparaît.
    setIdentityPortForTests("simule", null);
    await review.purgeVerificationData(new Date());
    expect((await db.identityCheck.findUniqueOrThrow({ where: { id: check.id } })).redactRequestedAt).not.toBeNull();
    expect(await review.redactionFailures()).toBe(before);
  });

  it("M4 : compte supprimé par purgeUnverifiedAccounts : la suppression chez le prestataire reste due, puis part", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Ginette");
    await svc.createIdentitySession(a.actor, { plateforme: "web", consentementBiometrie: true });
    const check = await db.identityCheck.findFirstOrThrow({ where: { verificationItem: { caregiver: { userId: a.u.id } } } });
    await db.user.update({ where: { id: a.u.id }, data: { emailVerifiedAt: null, createdAt: new Date(Date.now() - 8 * DAY) } });
    expect(await purgeUnverifiedAccounts(new Date(), true)).toBeGreaterThanOrEqual(1);
    expect(await db.user.findUnique({ where: { id: a.u.id } })).toBeNull();
    expect(await db.identityCheck.findUnique({ where: { id: check.id } })).toBeNull();
    const due = await db.providerRedaction.findUniqueOrThrow({ where: { providerSessionId: check.providerSessionId } });
    expect(due).toMatchObject({ provider: "simule", reason: "COMPTE_SUPPRIME", requestedAt: null });
    await review.purgeVerificationData(new Date());
    expect((await db.providerRedaction.findUniqueOrThrow({ where: { id: due.id } })).requestedAt).not.toBeNull();
    await db.providerRedaction.delete({ where: { id: due.id } });
  });

  // ─────────────── M7 : validation simulée en lancement ───────────────

  it("M7 : un téléphone validé par le code simulé compte comme NON validé en lancement, puis est remis à faire", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Sylvie");
    const c = await svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.0.7");
    await svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "000000" });
    expect(await item(a.u.id, "TELEPHONE")).toMatchObject({ status: "VALIDE", validatedWith: "simule" });
    expect((await review.blockersFor(a.profile.id, false)).join(" ")).not.toMatch(/Numéro de téléphone/);
    expect((await review.blockersFor(a.profile.id, true)).join(" ")).toMatch(/Numéro de téléphone/);
    await db.caregiverProfile.update({ where: { id: a.profile.id }, data: { validation: "VALIDE" } });
    process.env.KOUDMEN_MODE = "lancement";
    expect(await svc.resetSimulatedValidations(a.profile.id)).toBe(1);
    process.env.KOUDMEN_MODE = "essai";
    expect(await item(a.u.id, "TELEPHONE")).toMatchObject({ status: "A_FOURNIR", decisionCode: "VALIDATION_ESSAI", validatedWith: null });
    expect((await db.caregiverProfile.findUniqueOrThrow({ where: { id: a.profile.id } })).validation).toBe("EXPIRE");
    expect(await db.auditLog.count({ where: { action: "verification.reset_simulated", entityId: (await item(a.u.id, "TELEPHONE")).id } })).toBe(1);
  });

  it("M7 : une validation par un opérateur garde « operateur » et reste valable en lancement", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Paulette");
    await db.user.update({ where: { id: a.u.id }, data: { phone: phone() } });
    const tel = await item(a.u.id, "TELEPHONE");
    await review.decideItem(op1!, { itemId: tel.id, decision: "VALIDE", motif: null, cases: ["APPEL_DECROCHE"] });
    expect(await item(a.u.id, "TELEPHONE")).toMatchObject({ status: "VALIDE", validatedWith: "operateur" });
    process.env.KOUDMEN_MODE = "lancement";
    expect(await svc.resetSimulatedValidations(a.profile.id)).toBe(0);
    process.env.KOUDMEN_MODE = "essai";
    expect((await review.blockersFor(a.profile.id, true)).join(" ")).not.toMatch(/Numéro de téléphone/);
  });

  // ─────────────── Mineurs ───────────────

  it("m2 : plafond SMS par compte (un compte ne coupe pas le SMS pour tous)", async () => {
    const paid = new SimulatedOtpAdapter();
    paid.estimatedCostCents = () => 25;
    setOtpPortForTests("SMS", paid);
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Rémy");
    await svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.1.1");
    await svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.1.1");
    await expect(svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.1.1")).rejects.toMatchObject({ code: "TROP_DE_REQUETES" });
    expect(await db.auditLog.count({ where: { action: "otp.account_budget_reached", entityId: a.profile.id } })).toBe(1);
    // Un autre compte envoie encore.
    const b = await caregiver("SALARIE_FAMILLE_CESU", "Rita");
    await expect(svc.sendPhoneCode(b.actor, { telephone: phone(), canal: "SMS" }, "10.0.1.2")).resolves.toMatchObject({ canal: "SMS" });
  });

  it("m4 : un document décidé ne s'ouvre plus (sauf recours ouvert) ; refus journalisé ; fiche journalisée", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Lucien");
    await svc.saveDeclaredAddress(a.actor, { ligne: "1 rue Victor Hugo", codePostal: "97200", commune: "Fort-de-France" });
    const up = await svc.uploadDocument(a.actor, { type: "JUSTIFICATIF_DOMICILE", bytes: Buffer.from("%PDF-1.4 quittance fictive") });
    const adr = await item(a.u.id, "ADRESSE");
    expect(await review.getReviewItem(adr.id, op1!)).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "verification.fiche_opened", entityId: adr.id, actorId: op1!.id } })).toBe(1);
    expect(await review.openDocumentForReview(op1!, up.documentId, "REVUE_DOSSIER")).not.toBeNull();
    await review.decideItem(op1!, { itemId: adr.id, decision: "VALIDE", motif: null, cases: ["NOM_CONFORME", "ADRESSE_CONFORME", "MOINS_DE_3_MOIS", "TYPE_ACCEPTE", "SANS_RETOUCHE"] });
    expect(await review.openDocumentForReview(op2!, up.documentId, "CONTROLE_QUALITE")).toBeNull();
    expect(await db.auditLog.count({ where: { action: "document.access_refused", entityId: up.documentId } })).toBe(1);
    // Recours ouvert : accès possible avec le motif RECOURS.
    await db.caregiverProfile.update({ where: { id: a.profile.id }, data: { validation: "REFUSE", refusedAt: new Date() } });
    await svc.createAppeal(a.actor, "ERREUR_SUR_UN_DOCUMENT");
    expect(await review.openDocumentForReview(op3!, up.documentId, "RECOURS")).not.toBeNull();
  });

  it("m10 : profil suspendu : la confirmation d'un code est refusée", async () => {
    const a = await caregiver("SALARIE_FAMILLE_CESU", "Simone");
    const c = await svc.sendPhoneCode(a.actor, { telephone: phone(), canal: "SMS" }, "10.0.2.1");
    await db.caregiverProfile.update({ where: { id: a.profile.id }, data: { validation: "SUSPENDU" } });
    await expect(svc.confirmPhoneCode(a.actor, { challengeId: c.challengeId, code: "000000" })).rejects.toThrow(/suspendu/);
    expect((await item(a.u.id, "TELEPHONE")).status).toBe("A_FOURNIR");
  });
});
