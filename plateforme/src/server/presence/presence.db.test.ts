import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { Evenement } from "@/contracts/v1/visits";

/**
 * Test d'INTÉGRATION du lot L1-B sur une vraie base PostgreSQL (opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/presence/presence.db.test.ts
 * Carte domicile (QR signé), check-in L10, décision de la famille employeur (R7), trajet en direct (L6, R4).
 * Il crée ses propres données (préfixe unique), puis les supprime.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
const H = 3_600_000;
// Domicile géocodé au Lamentin.
const HOME = { lat: 14.6131, lng: -60.9996 };
/** Point à `m` mètres au nord du domicile. */
const north = (m: number) => ({ latitude: HOME.lat + m / 111_320, longitude: HOME.lng });

describe.runIf(enabled)("Lot L1-B (présence) sur une vraie base", async () => {
  process.env.NEXT_PUBLIC_TEST_MODE = "true";
  const { db } = await import("@/server/db");
  const app = await import("@/server/visits/app-service");
  const card = await import("./home-card");
  const review = await import("./review");
  const tag = `l1b-${randomBytes(4).toString("hex")}`;
  const userIds: string[] = [];
  const aineIds: string[] = [];

  async function user(role: "FAMILLE" | "ACCOMPAGNANT" | "OPERATEUR", firstName: string) {
    const u = await db.user.create({
      data: { email: `${firstName.toLowerCase()}-${tag}@test.koudmen.test`, passwordHash: "x", role, firstName, lastName: "Test" },
    });
    userIds.push(u.id);
    return u;
  }

  let payeur: Awaited<ReturnType<typeof user>>;
  let cousin: Awaited<ReturnType<typeof user>>;
  let operateur: Awaited<ReturnType<typeof user>>;
  let alice: { user: { id: string; role: "ACCOMPAGNANT"; firstName: string; sandboxId: null }; profileId: string };
  let aineId: string;
  let otherAineId: string;

  async function caregiver(firstName: string) {
    const u = await user("ACCOMPAGNANT", firstName);
    const p = await db.caregiverProfile.create({
      data: { userId: u.id, status: "BENEVOLE_ASSO", allowedLevels: [1, 2], communes: ["LAMENTIN"], validation: "VALIDE", associationName: "Asso" },
    });
    return { user: { id: u.id, role: "ACCOMPAGNANT" as const, firstName, sandboxId: null }, profileId: p.id };
  }

  async function aine(firstName: string, ownerId: string) {
    const a = await db.aine.create({
      data: {
        firstName,
        commune: "LAMENTIN",
        latitude: HOME.lat,
        longitude: HOME.lng,
        locationApproximate: false,
        needs: ["COMPAGNIE"],
        activityLevel: 1,
        consentGiven: true,
        consentByType: "AINE",
        consentByName: "Test",
        consentAt: new Date(),
        homeCode: `Q${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`,
        ownerId,
        members: { create: [{ userId: ownerId, relation: "fille", isPayer: true }] },
      },
    });
    aineIds.push(a.id);
    return a.id;
  }

  async function visitFor(cg: typeof alice, startInH = -0.2, forAine = aineId) {
    const request = await db.careRequest.create({
      data: { aineId: forAine, createdById: payeur.id, level: 1, frequency: "HEBDOMADAIRE", durationMinutes: 60, status: "POURVUE" },
    });
    const proposal = await db.missionProposal.create({
      data: { requestId: request.id, caregiverId: cg.profileId, proposedById: operateur.id, status: "ACCEPTEE", respondedAt: new Date() },
    });
    const mission = await db.mission.create({ data: { requestId: request.id, proposalId: proposal.id, aineId: forAine, caregiverId: cg.profileId } });
    const start = new Date(Date.now() + startInH * H);
    return db.visit.create({ data: { missionId: mission.id, aineId: forAine, caregiverId: cg.profileId, scheduledStart: start, scheduledEnd: new Date(start.getTime() + H) } });
  }

  function checkIn(visiteId: string, fields: Record<string, unknown>, survenuA = new Date()): Evenement {
    return { clientEventId: randomUUID(), survenuA: survenuA.toISOString(), type: "CHECK_IN", visiteId, ...fields } as Evenement;
  }

  async function qrOf(id: string, actor: { id: string; role: "FAMILLE" | "OPERATEUR"; sandboxId: null } = { ...payeur, role: "FAMILLE", sandboxId: null }) {
    return (await card.getHomeCard(actor, id)).qrContent;
  }

  beforeAll(async () => {
    payeur = await user("FAMILLE", "Payeur");
    cousin = await user("FAMILLE", "Cousin");
    operateur = await user("OPERATEUR", "Operateur");
    alice = await caregiver("Alice");
    aineId = await aine("Léonie", payeur.id);
    otherAineId = await aine("Marcel", payeur.id);
    await db.lakouMember.create({ data: { aineId, userId: cousin.id, relation: "cousin", isPayer: false } });
  });

  afterAll(async () => {
    const visits = await db.visit.findMany({ where: { aineId: { in: aineIds } }, select: { id: true } });
    const related = [...userIds, ...aineIds, ...visits.map((v) => v.id)];
    await db.outboxMessage.deleteMany({ where: { OR: [{ recipientUserId: { in: userIds } }, { relatedId: { in: related } }] } });
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: related } }] } });
    await db.aine.deleteMany({ where: { id: { in: aineIds } } });
    await db.careRequest.deleteMany({ where: { createdById: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  // ─────────────── Carte domicile ───────────────

  it("carte : lisible par le cercle et l'opérateur, pas par un accompagnant ; régénération par le payeur ou l'opérateur seulement", async () => {
    const view = await card.getHomeCard({ id: cousin.id, role: "FAMILLE", sandboxId: null }, aineId);
    expect(view.qrContent).toMatch(/^koudmen:domicile:s1:/);
    expect(view.qrContent).not.toContain(aineId);
    expect(view.canRegenerate).toBe(false);
    await expect(card.regenerateHomeCard({ id: cousin.id, role: "FAMILLE", sandboxId: null }, aineId)).rejects.toThrow(/gestionnaire/);
    await expect(card.getHomeCard({ id: alice.user.id, role: "ACCOMPAGNANT", sandboxId: null }, aineId)).rejects.toMatchObject({ code: "INTROUVABLE" });
    expect((await card.getHomeCard({ id: operateur.id, role: "OPERATEUR", sandboxId: null }, aineId)).canRegenerate).toBe(true);
  });

  // ─────────────── Check-in L10 ───────────────

  it("QR signé + position à 60 m → VALIDE ; aucune coordonnée brute gardée, distance arrondie", async () => {
    const v = await visitFor(alice);
    const [r] = await app.processAppEvents(alice.user, [
      checkIn(v.id, { qr: await qrOf(aineId), position: { ...north(60), precisionMetres: 15, consentement: true } }),
    ]);
    expect(r).toMatchObject({ statut: "ACCEPTE", statutPreuve: "VALIDE", visite: { statut: "VALIDEE", score: 2 } });
    const gps = await db.visitProof.findUniqueOrThrow({ where: { visitId_factor: { visitId: v.id, factor: "GPS" } } });
    expect(gps).toMatchObject({ valid: true, latitude: null, longitude: null, accuracyMeters: null, distanceMeters: 60 });
    const audit = JSON.stringify(await db.auditLog.findMany({ where: { entityId: v.id } }));
    expect(audit).not.toContain("14.61");
    expect(audit).not.toContain("koudmen:domicile");
  });

  it("position simulée ou trop loin → accepté mais À VÉRIFIER, avec la raison", async () => {
    const v1 = await visitFor(alice);
    const [r1] = await app.processAppEvents(alice.user, [
      checkIn(v1.id, { qr: await qrOf(aineId), position: { ...north(10), precisionMetres: 5, consentement: true, simulee: true } }),
    ]);
    expect(r1).toMatchObject({ statut: "ACCEPTE", statutPreuve: "A_VERIFIER" });
    expect(r1!.raison).toMatch(/simulée/);
    const v2 = await visitFor(alice);
    const [r2] = await app.processAppEvents(alice.user, [checkIn(v2.id, { qr: await qrOf(aineId), position: { ...north(800), precisionMetres: 10, consentement: true } })]);
    expect(r2).toMatchObject({ statutPreuve: "A_VERIFIER" });
    expect(r2!.raison).toMatch(/trop loin/);
  });

  it("QR faux, d'un autre domicile, ou révoqué (carte régénérée) → REFUSE ; le code de secours marche", async () => {
    const v = await visitFor(alice);
    const [faux] = await app.processAppEvents(alice.user, [checkIn(v.id, { qr: "koudmen:domicile:s1:eyJhbGciOiJFZERTQSJ9.eyJjIjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQSIsInYiOjF9.AAAA" })]);
    expect(faux).toMatchObject({ statut: "REFUSE", statutPreuve: "REFUSE" });
    const [autre] = await app.processAppEvents(alice.user, [checkIn(v.id, { qr: await qrOf(otherAineId) })]);
    expect(autre).toMatchObject({ statut: "REFUSE", statutPreuve: "REFUSE", raison: "Ce QR code est celui d'un autre domicile." });

    const oldQr = await qrOf(aineId);
    const before = await db.aine.findUniqueOrThrow({ where: { id: aineId }, select: { homeCode: true, homeCardVersion: true } });
    await card.regenerateHomeCard({ id: payeur.id, role: "FAMILLE", sandboxId: null }, aineId);
    const after = await db.aine.findUniqueOrThrow({ where: { id: aineId }, select: { homeCode: true, homeCardVersion: true } });
    expect(after.homeCardVersion).toBe(before.homeCardVersion + 1);
    expect(after.homeCode).not.toBe(before.homeCode);
    expect(await db.auditLog.count({ where: { action: "aine.home_card.regenerated", entityId: aineId } })).toBe(1);
    const [revoque] = await app.processAppEvents(alice.user, [checkIn(v.id, { qr: oldQr })]);
    expect(revoque).toMatchObject({ statut: "REFUSE", statutPreuve: "REFUSE" });
    expect(revoque!.raison).toMatch(/remplacée/);
    const [ancienCode] = await app.processAppEvents(alice.user, [checkIn(v.id, { codeDomicile: before.homeCode })]);
    expect(ancienCode).toMatchObject({ statut: "REFUSE" });
    const [code] = await app.processAppEvents(alice.user, [checkIn(v.id, { codeDomicile: after.homeCode })]);
    expect(code).toMatchObject({ statut: "ACCEPTE", statutPreuve: "A_VERIFIER" });
    expect(code!.raison).toMatch(/Position non envoyée/);
  });

  it("hors fenêtre (début − 2 h) → REFUSE", async () => {
    process.env.NEXT_PUBLIC_TEST_MODE = "false";
    const demo = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "false";
    try {
      const v = await visitFor(alice, 5);
      const [r] = await app.processAppEvents(alice.user, [checkIn(v.id, { qr: await qrOf(aineId) })]);
      expect(r).toMatchObject({ statut: "REFUSE", statutPreuve: "REFUSE" });
      expect(r!.raison).toMatch(/2 heures avant/);
    } finally {
      process.env.NEXT_PUBLIC_TEST_MODE = "true";
      process.env.DEMO_MODE = demo;
    }
  });

  it("check-in reçu plus de 30 min après l'heure du téléphone → À vérifier, même avec 2 preuves (P1/P8)", async () => {
    const v = await visitFor(alice, -1);
    const [r] = await app.processAppEvents(alice.user, [
      checkIn(v.id, { qr: await qrOf(aineId), position: { ...north(20), precisionMetres: 10, consentement: true } }, new Date(Date.now() - 45 * 60_000)),
    ]);
    expect(r).toMatchObject({ statut: "ACCEPTE", statutPreuve: "A_VERIFIER", visite: { statut: "A_VERIFIER" } });
    expect(r!.raison).toMatch(/30 minutes/);
    expect((await db.visit.findUniqueOrThrow({ where: { id: v.id } })).lateCheckInAt).not.toBeNull();
  });

  // ─────────────── Adresse (L8, R7) ───────────────

  it("adresse : chiffrée en base, géocodée (adaptateur simulé), repli centre de commune ; lue par l'accompagnant le jour de la visite seulement, journalisée", async () => {
    const address = await import("./address");
    const exact = await address.computeHomeLocation("12 rue Schoelcher", "LAMENTIN");
    expect(exact).toMatchObject({ locationApproximate: false });
    expect(exact.addressEnc).toMatch(/^a1:/);
    const repli = await address.computeHomeLocation("adresse introuvable", "LAMENTIN");
    expect(repli).toMatchObject({ locationApproximate: true, latitude: 14.6131, longitude: -60.9996 });
    await db.aine.update({ where: { id: aineId }, data: { addressEnc: exact.addressEnc } });
    expect(JSON.stringify(await db.aine.findUniqueOrThrow({ where: { id: aineId } }))).not.toContain("Schoelcher");

    const today = await visitFor(alice, 0.5);
    expect(await address.readAddressForCaregiver(alice.user, today.id)).toBe("12 rue Schoelcher");
    expect(await db.auditLog.count({ where: { action: "aine.address.read", entityId: aineId, actorId: alice.user.id } })).toBe(1);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "aine.address.read", entityId: aineId } });
    expect(JSON.stringify(log)).not.toContain("Schoelcher");
    const later = await visitFor(alice, 72);
    expect(await address.readAddressForCaregiver(alice.user, later.id)).toBeNull();
    const intrus = await caregiver("Intrus");
    expect(await address.readAddressForCaregiver(intrus.user, today.id)).toBeNull();
    await db.aine.update({ where: { id: aineId }, data: { addressEnc: null } });
  });

  // ─────────────── Trajet en direct (L6, R3, R4) ───────────────

  it("trajet : 409 sans trajet, départ masqué, arrondi, 30 s, vue employeur + personne désignée, arrêt à l'arrivée, aucune coordonnée au journal", async () => {
    const trajet = await import("./trajet");
    const v = await visitFor(alice, 1);
    const pos = (m: number, at = new Date()) => ({ ...north(m), precisionMetres: 12, survenuA: at.toISOString() });
    await expect(trajet.recordTripPosition(alice.user, v.id, pos(3000))).rejects.toMatchObject({ code: "CONFLIT" });
    const intrus = await caregiver("Autre");
    await expect(trajet.startOrStopTrip(intrus.user, v.id, "DEMARRER")).rejects.toMatchObject({ code: "INTROUVABLE" });

    const started = await trajet.startOrStopTrip(alice.user, v.id, "DEMARRER");
    expect(started.trajet.etat).toBe("EN_COURS");
    expect(new Date(started.trajet.expireA!).getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
    const t0 = Date.now();
    expect(await trajet.recordTripPosition(alice.user, v.id, pos(3000), new Date(t0))).toBe("GARDEE");
    await expect(trajet.recordTripPosition(alice.user, v.id, pos(2900), new Date(t0 + 10_000))).rejects.toMatchObject({ code: "TROP_DE_REQUETES" });
    const row = await db.visitTrip.findUniqueOrThrow({ where: { visitId: v.id } });
    expect(Math.round(row.latitude! * 1000)).toBe(row.latitude! * 1000);

    const payeurActor = { id: payeur.id, role: "FAMILLE" as const, sandboxId: null };
    const cousinActor = { id: cousin.id, role: "FAMILLE" as const, sandboxId: null };
    // Départ masqué : la famille voit seulement l'heure prévue.
    expect(await trajet.getFamilyTripView(payeurActor, v.id)).toMatchObject({ etat: "PREVUE" });
    expect((await trajet.getFamilyTripView(payeurActor, v.id))!.position).toBeUndefined();
    // > 500 m du départ : position visible, distance et minutes.
    expect(await trajet.recordTripPosition(alice.user, v.id, pos(2000, new Date(t0 + 31_000)), new Date(t0 + 31_000))).toBe("GARDEE");
    const view = await trajet.getFamilyTripView(payeurActor, v.id);
    expect(view).toMatchObject({ etat: "EN_ROUTE", accompagnant: { prenom: "Alice" } });
    expect(view!.distanceMetres).toBeGreaterThan(1800);
    expect(view!.minutesEstimees).toBeGreaterThan(0);
    // Cercle Lakou sans être désigné : rien. Désigné : oui.
    expect(await trajet.getFamilyTripView(cousinActor, v.id)).toBeNull();
    await db.aine.update({ where: { id: aineId }, data: { tripViewerId: cousin.id } });
    expect((await trajet.getFamilyTripView(cousinActor, v.id))?.etat).toBe("EN_ROUTE");
    await db.aine.update({ where: { id: aineId }, data: { tripViewerId: null } });
    // Opérateur : oui/non seulement ; position seulement pendant un SOS, accès journalisé.
    expect((await trajet.visitsWithActiveTrip([v.id])).has(v.id)).toBe(true);
    const op = { id: operateur.id, role: "OPERATEUR" as const, sandboxId: null };
    expect(await trajet.getOperatorSosPosition(op, v.id)).toEqual({ sosActif: false });
    await db.auditLog.create({ data: { actorId: alice.user.id, actorRole: "ACCOMPAGNANT", action: "sos.triggered", entityType: "Visit", entityId: v.id } });
    const sos = await trajet.getOperatorSosPosition(op, v.id);
    expect(sos).toMatchObject({ sosActif: true });
    expect(sos && "position" in sos && sos.position).toBeTruthy();
    expect(await db.auditLog.count({ where: { action: "trip.position.viewed_sos", entityId: v.id } })).toBe(1);

    // Arrivée à moins de 150 m du domicile : le trajet s'arrête et la ligne est effacée.
    expect(await trajet.recordTripPosition(alice.user, v.id, pos(80, new Date(t0 + 62_000)), new Date(t0 + 62_000))).toBe("ARRIVEE");
    expect(await db.visitTrip.count({ where: { visitId: v.id } })).toBe(0);
    expect(await trajet.getFamilyTripView(payeurActor, v.id)).toMatchObject({ etat: "PREVUE" });

    const journal = JSON.stringify(await db.auditLog.findMany({ where: { entityId: v.id } }));
    expect(journal).toContain("trip.started");
    expect(journal).toContain("ARRIVEE");
    expect(journal).not.toMatch(/14\.6\d/);
  });

  it("trajet : arrêt au check-in et à ARRETER, purge des trajets expirés", async () => {
    const trajet = await import("./trajet");
    const v = await visitFor(alice, 0.5);
    await trajet.startOrStopTrip(alice.user, v.id, "DEMARRER");
    await app.processAppEvents(alice.user, [checkIn(v.id, { qr: await qrOf(aineId) })]);
    expect(await db.visitTrip.count({ where: { visitId: v.id } })).toBe(0);
    await expect(trajet.startOrStopTrip(alice.user, v.id, "DEMARRER")).rejects.toMatchObject({ code: "CONFLIT" });

    const v2 = await visitFor(alice, 0.5);
    await trajet.startOrStopTrip(alice.user, v2.id, "DEMARRER");
    expect(await trajet.startOrStopTrip(alice.user, v2.id, "ARRETER")).toEqual({ trajet: { etat: "ARRETE", expireA: null } });
    expect(await db.visitTrip.count({ where: { visitId: v2.id } })).toBe(0);

    await trajet.startOrStopTrip(alice.user, v2.id, "DEMARRER");
    await db.visitTrip.update({ where: { visitId: v2.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(trajet.recordTripPosition(alice.user, v2.id, { ...north(900), precisionMetres: 10, survenuA: new Date().toISOString() })).rejects.toMatchObject({ code: "CONFLIT" });
    await trajet.startOrStopTrip(alice.user, v2.id, "DEMARRER");
    await db.visitTrip.update({ where: { visitId: v2.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await trajet.purgeTrips()).toBeGreaterThanOrEqual(1);
    expect(await db.visitTrip.count({ where: { visitId: v2.id } })).toBe(0);
  });

  // ─────────────── R7 : la famille employeur tranche ───────────────

  it("visite À vérifier : seul le payeur tranche ; confirmer → VALIDEE ; signaler → opérateurs prévenus", async () => {
    const v = await visitFor(alice, -3);
    await app.processAppEvents(alice.user, [checkIn(v.id, { qr: await qrOf(aineId) }, new Date(Date.now() - 2.9 * H))]);
    await db.visit.update({ where: { id: v.id }, data: { checkOutAt: new Date() } });
    const { refreshVisitStatus } = await import("@/server/visits/service");
    expect((await refreshVisitStatus(v.id)).status).toBe("A_VERIFIER");
    const cousinActor = { id: cousin.id, role: "FAMILLE" as const, firstName: "Cousin", sandboxId: null };
    await expect(review.decideVisitReview(cousinActor, v.id, "CONFIRMER")).rejects.toThrow(/employeur/);
    const payeurActor = { id: payeur.id, role: "FAMILLE" as const, firstName: "Payeur", sandboxId: null };
    expect((await review.decideVisitReview(payeurActor, v.id, "CONFIRMER")).status).toBe("VALIDEE");
    await expect(review.decideVisitReview(payeurActor, v.id, "CONFIRMER")).rejects.toThrow(/pas à vérifier/);

    const v2 = await visitFor(alice, -3);
    await db.visit.update({ where: { id: v2.id }, data: { checkInAt: new Date(Date.now() - 2.5 * H), checkOutAt: new Date(), status: "A_VERIFIER" } });
    await review.decideVisitReview(payeurActor, v2.id, "SIGNALER");
    expect(await db.auditLog.count({ where: { action: "visit.review.reported", entityId: v2.id } })).toBe(1);
    expect((await db.visit.findUniqueOrThrow({ where: { id: v2.id } })).status).toBe("A_VERIFIER");
  });
});
