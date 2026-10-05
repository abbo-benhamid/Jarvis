import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { Evenement } from "@/contracts/v1/visits";

/**
 * Test d'INTÉGRATION du lot A2 sur une vraie base PostgreSQL (opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/visits/app-service.db.test.ts
 * Il crée ses propres données (préfixe unique), puis les supprime. Il ne touche pas aux données de démo.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
const H = 3_600_000;

describe.runIf(enabled)("Lot A2 (API v1 : visites, événements, propositions) sur une vraie base", async () => {
  process.env.NEXT_PUBLIC_TEST_MODE = "true";
  const { db } = await import("@/server/db");
  const app = await import("./app-service");
  const tag = `a2-${randomBytes(4).toString("hex")}`;
  const userIds: string[] = [];
  const aineIds: string[] = [];

  async function user(role: "FAMILLE" | "ACCOMPAGNANT" | "OPERATEUR", firstName: string) {
    const u = await db.user.create({
      data: { email: `${firstName.toLowerCase()}-${tag}@test.koudmen.test`, passwordHash: "x", role, firstName, lastName: "Test" },
    });
    userIds.push(u.id);
    return u;
  }
  async function caregiver(firstName: string, validation: "VALIDE" | "SUSPENDU" = "VALIDE") {
    const u = await user("ACCOMPAGNANT", firstName);
    const p = await db.caregiverProfile.create({
      data: { userId: u.id, status: "SALARIE_FAMILLE_CESU", allowedLevels: [1, 2, 3], communes: ["LAMENTIN"], hourlyRateCents: 1650, validation },
    });
    return { user: { id: u.id, role: u.role, firstName, sandboxId: null }, profile: p };
  }

  let famille: Awaited<ReturnType<typeof user>>;
  let operateur: Awaited<ReturnType<typeof user>>;
  let alice: Awaited<ReturnType<typeof caregiver>>;
  let bruno: Awaited<ReturnType<typeof caregiver>>;
  let carla: Awaited<ReturnType<typeof caregiver>>;
  let aineId: string;
  let homeCode: string;

  /** Mission active + une visite qui commence `startInH` heures après maintenant. */
  async function visitFor(cg: Awaited<ReturnType<typeof caregiver>>, startInH = -0.2) {
    const request = await db.careRequest.create({
      data: { aineId, createdById: famille.id, level: 1, frequency: "HEBDOMADAIRE", durationMinutes: 60, status: "POURVUE", notes: "Elle aime les dominos." },
    });
    const proposal = await db.missionProposal.create({
      data: { requestId: request.id, caregiverId: cg.profile.id, proposedById: operateur.id, status: "ACCEPTEE", respondedAt: new Date() },
    });
    const mission = await db.mission.create({
      data: { requestId: request.id, proposalId: proposal.id, aineId, caregiverId: cg.profile.id, hourlyRateCents: 1650 },
    });
    const start = new Date(Date.now() + startInH * H);
    return db.visit.create({
      data: { missionId: mission.id, aineId, caregiverId: cg.profile.id, scheduledStart: start, scheduledEnd: new Date(start.getTime() + H) },
    });
  }

  function ev<T extends Evenement["type"]>(type: T, fields: Record<string, unknown>, survenuA = new Date()): Evenement {
    return { clientEventId: randomUUID(), survenuA: survenuA.toISOString(), type, ...fields } as Evenement;
  }

  beforeAll(async () => {
    famille = await user("FAMILLE", "Famille");
    operateur = await user("OPERATEUR", "Operateur");
    alice = await caregiver("Alice");
    bruno = await caregiver("Bruno");
    carla = await caregiver("Carla", "SUSPENDU");
    homeCode = `Z${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
    const aine = await db.aine.create({
      data: {
        firstName: "Aîné",
        lastInitial: "T.",
        commune: "LAMENTIN",
        addressHint: "Quartier Bas-Mission (fictif)",
        latitude: 14.6131,
        longitude: -60.9996,
        phone: "+596 596 00 00 00",
        needs: ["AIDE_RENFORCEE"],
        activityLevel: 2,
        consentGiven: true,
        consentByType: "AINE",
        consentByName: "Test",
        consentAt: new Date(),
        homeCode,
        ownerId: famille.id,
        members: { create: { userId: famille.id, relation: "fille", isPayer: true } },
      },
    });
    aineId = aine.id;
    aineIds.push(aine.id);
  });

  afterAll(async () => {
    const visits = await db.visit.findMany({ where: { aineId: { in: aineIds } }, select: { id: true } });
    const related = [...userIds, ...visits.map((v) => v.id)];
    await db.outboxMessage.deleteMany({ where: { OR: [{ recipientUserId: { in: userIds } }, { relatedId: { in: related } }] } });
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: related } }] } });
    await db.aine.deleteMany({ where: { id: { in: aineIds } } });
    await db.careRequest.deleteMany({ where: { createdById: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("GET /visites : seulement ses visites, adresse approximative, jamais le code ni le téléphone ni les besoins", async () => {
    const v = await visitFor(alice);
    const list = await app.listAppVisits(alice.user.id, 7);
    expect(list.map((x) => x.id)).toContain(v.id);
    const dto = list.find((x) => x.id === v.id)!;
    expect(dto.aine).toMatchObject({ prenom: "Aîné", commune: "LAMENTIN", adresseApproximative: "Quartier Bas-Mission (fictif)" });
    expect(dto.demande.consignes).toBe("Elle aime les dominos.");
    const raw = JSON.stringify(list);
    for (const forbidden of [homeCode, "+596", "AIDE_RENFORCEE", "14.61"]) expect(raw).not.toContain(forbidden);
    expect((await app.listAppVisits(bruno.user.id, 7)).map((x) => x.id)).not.toContain(v.id);
    expect(await app.getAppVisit(bruno.user.id, v.id)).toBeNull();
    expect((await app.getAppVisit(alice.user.id, v.id))?.id).toBe(v.id);
  });

  it("doublon ignoré : même clientEventId dans le lot et dans un second envoi → un seul check-in", async () => {
    const v = await visitFor(alice);
    const checkIn = ev("CHECK_IN", { visiteId: v.id, codeDomicile: homeCode.toLowerCase() });
    const [r1, r2] = await app.processAppEvents(alice.user, [checkIn, checkIn]);
    expect(r1).toMatchObject({ statut: "ACCEPTE", visite: { id: v.id, statut: "EN_COURS", score: 1 }, preuves: { code: { valide: true } } });
    expect(r2).toMatchObject({ statut: "DOUBLON", statutOrigine: "ACCEPTE" });
    const [r3] = await app.processAppEvents(alice.user, [checkIn]);
    expect(r3).toMatchObject({ statut: "DOUBLON", statutOrigine: "ACCEPTE" });
    expect(await db.visitProof.count({ where: { visitId: v.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "visit.checkin", entityId: v.id } })).toBe(1);
    expect(await db.appEvent.count({ where: { userId: alice.user.id, clientEventId: checkIn.clientEventId } })).toBe(1);
  });

  it("code faux renvoyé deux fois : un seul essai consommé, refus rejoué à l'identique", async () => {
    const v = await visitFor(alice);
    const wrong = ev("CHECK_IN", { visiteId: v.id, codeDomicile: "XXXXXX" });
    const [r1] = await app.processAppEvents(alice.user, [wrong]);
    expect(r1).toMatchObject({ statut: "REFUSE", motif: "INVALIDE" });
    const [r2] = await app.processAppEvents(alice.user, [wrong]);
    expect(r2).toMatchObject({ statut: "DOUBLON", statutOrigine: "REFUSE", message: r1!.message });
    expect(await db.auditLog.count({ where: { action: "visit.code.failed", entityId: v.id } })).toBe(1);
  });

  it("position ponctuelle consentie au check-in, puis check-out sans position : visite validée par code + GPS", async () => {
    const v = await visitFor(alice);
    const [r] = await app.processAppEvents(alice.user, [
      ev("CHECK_IN", { visiteId: v.id, codeDomicile: homeCode, position: { latitude: 14.6135, longitude: -60.9995, precisionMetres: 15, consentement: true } }),
      ev("CHECK_OUT", { visiteId: v.id }),
    ]);
    expect(r).toMatchObject({ statut: "ACCEPTE", preuves: { code: { valide: true }, position: { valide: true } } });
    const after = await db.visit.findUniqueOrThrow({ where: { id: v.id }, include: { proofs: true } });
    expect(after.status).toBe("VALIDEE");
    expect(after.checkOutAt).not.toBeNull();
    expect(after.proofs.filter((p) => p.factor === "GPS")).toHaveLength(1);
  });

  it("brouillon de Kayé : le plus récent gagne, puis effacé à la publication ; le texte publié n'est jamais renvoyé", async () => {
    const v = await visitFor(alice);
    const t0 = Date.now();
    await app.processAppEvents(alice.user, [
      ev("CHECK_IN", { visiteId: v.id, codeDomicile: homeCode }),
      ev("KAYE_BROUILLON", { visiteId: v.id, kaye: { humeur: 4, note: "Récent" } }, new Date(t0)),
      ev("KAYE_BROUILLON", { visiteId: v.id, kaye: { humeur: 2, note: "Ancien" } }, new Date(t0 - 60_000)),
    ]);
    expect((await app.getAppVisit(alice.user.id, v.id))?.brouillonKaye).toEqual({ humeur: 4, note: "Récent" });
    const [pub] = await app.processAppEvents(alice.user, [
      ev("KAYE_PUBLICATION", { visiteId: v.id, kaye: { humeur: 4, appetit: "BON", activites: ["Dominos", "Dominos"], note: "Belle journée", aSurveiller: false } }),
    ]);
    expect(pub).toMatchObject({ statut: "ACCEPTE" });
    expect(await db.kayeDraft.count({ where: { visitId: v.id } })).toBe(0);
    const entry = await db.journalEntry.findUniqueOrThrow({ where: { visitId: v.id } });
    expect(entry.activities).toEqual(["Dominos"]);
    const detail = await app.getAppVisit(alice.user.id, v.id);
    expect(detail).toMatchObject({ kayePublie: true, brouillonKaye: null });
    expect(JSON.stringify(detail)).not.toContain("Belle journée");
    const [again] = await app.processAppEvents(alice.user, [ev("KAYE_PUBLICATION", { visiteId: v.id, kaye: { humeur: 3, appetit: "BON", activites: [], aSurveiller: false } })]);
    expect(again).toMatchObject({ statut: "REFUSE", motif: "CONFLIT" });
  });

  it("écart d'horloge > 12 h : visite « À vérifier », même avec 2 facteurs ; signalé dans la réponse", async () => {
    const v = await visitFor(alice);
    const wrongClock = new Date(Date.now() - 13 * H);
    const [r] = await app.processAppEvents(alice.user, [
      ev("CHECK_IN", { visiteId: v.id, codeDomicile: homeCode, position: { latitude: 14.6131, longitude: -60.9996, consentement: true } }, wrongClock),
    ]);
    expect(r).toMatchObject({ statut: "ACCEPTE", horlogeSuspecte: true, visite: { id: v.id, statut: "A_VERIFIER", score: 2 } });
    const after = await db.visit.findUniqueOrThrow({ where: { id: v.id } });
    expect(after.clockSkewAt).not.toBeNull();
    expect(after.status).toBe("A_VERIFIER");
    // Le check-in garde l'heure du serveur, pas celle de l'appareil.
    expect(after.checkInAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(await db.auditLog.count({ where: { action: "visit.clock_skew", entityId: v.id } })).toBe(1);
    expect((await app.getAppVisit(alice.user.id, v.id))?.preuve.horlogeSuspecte).toBe(true);
  });

  it("IDOR : un événement sur la visite d'un autre accompagnant est refusé INTROUVABLE, sans effet", async () => {
    const v = await visitFor(alice);
    const results = await app.processAppEvents(bruno.user, [
      ev("CHECK_IN", { visiteId: v.id, codeDomicile: homeCode }),
      ev("KAYE_BROUILLON", { visiteId: v.id, kaye: { humeur: 1 } }),
      ev("CHECK_OUT", { visiteId: v.id }),
    ]);
    for (const r of results) {
      expect(r).toMatchObject({ statut: "REFUSE", motif: "INTROUVABLE" });
      expect(r.visite).toBeUndefined();
    }
    expect(await db.visitProof.count({ where: { visitId: v.id } })).toBe(0);
    expect(await db.kayeDraft.count({ where: { visitId: v.id } })).toBe(0);
  });

  it("accompagnant suspendu : événements refusés (COMPTE_INACTIF), mais le SOS passe et prévient l'opérateur", async () => {
    const v = await visitFor(carla);
    const [checkIn, sos] = await app.processAppEvents(carla.user, [ev("CHECK_IN", { visiteId: v.id, codeDomicile: homeCode }), ev("SOS", { visiteId: v.id })]);
    expect(checkIn).toMatchObject({ statut: "REFUSE", motif: "COMPTE_INACTIF" });
    expect(sos).toMatchObject({ statut: "ACCEPTE" });
    expect(sos!.consigne).toContain("112");
    expect(await db.visitProof.count({ where: { visitId: v.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "sos.triggered", entityId: v.id } })).toBe(1);
    const msg = await db.outboxMessage.findFirst({ where: { recipientUserId: operateur.id, template: "SOS_ACCOMPAGNANT", relatedId: v.id } });
    expect(msg?.body).toContain("Carla");
    expect(msg?.body).not.toContain("Aîné");
  });

  it("propositions : liste, refus SANS pénalité (profil inchangé, propositions suivantes toujours visibles)", async () => {
    const mk = async () => {
      const r = await db.careRequest.create({
        data: { aineId, createdById: famille.id, level: 1, frequency: "HEBDOMADAIRE", durationMinutes: 60, status: "PROPOSEE", slots: { create: [{ dayOfWeek: 2, slot: "MATIN" }] } },
      });
      return db.missionProposal.create({ data: { requestId: r.id, caregiverId: bruno.profile.id, proposedById: operateur.id } });
    };
    const p1 = await mk();
    const p2 = await mk();
    const before = await db.caregiverProfile.findUniqueOrThrow({ where: { id: bruno.profile.id } });
    const list = await app.listAppProposals(bruno.user.id);
    expect(list.map((p) => p.id)).toEqual(expect.arrayContaining([p1.id, p2.id]));
    expect(list.find((p) => p.id === p1.id)?.demande.creneaux).toEqual([{ jour: 2, creneau: "MATIN" }]);

    const { declineProposal } = await import("@/server/accompagnant/service");
    await declineProposal({ id: bruno.user.id, role: "ACCOMPAGNANT", firstName: "Bruno" }, p1.id, null);
    const after = await db.caregiverProfile.findUniqueOrThrow({ where: { id: bruno.profile.id } });
    expect({ v: after.validation, l: after.allowedLevels, c: after.communes, t: after.hourlyRateCents }).toEqual({
      v: before.validation,
      l: before.allowedLevels,
      c: before.communes,
      t: before.hourlyRateCents,
    });
    const remaining = (await app.listAppProposals(bruno.user.id)).map((p) => p.id);
    expect(remaining).toContain(p2.id);
    expect(remaining).not.toContain(p1.id);
  });
});
