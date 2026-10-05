import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  reponseAcceptationSchema,
  reponseCodeSchema,
  reponseErreurSchema,
  reponseEvenementsSchema,
  reponseJetonsSchema,
  reponsePropositionsSchema,
  reponseRefusSchema,
  reponseVisiteSchema,
  reponseVisitesSchema,
} from "../src/contracts/v1";
import { DEMO_PASSWORD, cleanupE2E, createCaregiver, createFamilyWithAine, createRequest, operatorId, prisma } from "./fixtures";

/**
 * API v1 (lot A2, ADR 0008) : parcours de l'app accompagnant sur le compte de démo seedé.
 * connexion → visites → check-in (code) → doublon ignoré → Kayé (brouillon puis publication) → propositions.
 * IDOR : la visite d'un autre accompagnant répond 404.
 * Les données créées appartiennent à des comptes e2e (@e2e.koudmen.test) : cleanupE2E() les efface.
 * Le compte démo n'est pas modifié (ses traces de test sont effacées à la fin).
 */
const DEMO_EMAIL = "accompagnant@demo.koudmen.test";
const H = 3_600_000;

async function login(request: APIRequestContext) {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const data = DEMO_PASSWORD
    ? { methode: "mot_de_passe", email: DEMO_EMAIL, motDePasse: DEMO_PASSWORD, codeChallenge: challenge }
    : { methode: "demo", role: "ACCOMPAGNANT", codeChallenge: challenge };
  const codeRes = await request.post("/api/v1/auth/code", { data });
  expect(codeRes.status()).toBe(200);
  const { code } = reponseCodeSchema.parse(await codeRes.json());
  const tokenRes = await request.post("/api/v1/auth/token", { data: { code, codeVerifier: verifier } });
  expect(tokenRes.status()).toBe(200);
  return reponseJetonsSchema.parse(await tokenRes.json());
}

/** Mission active + visite qui a commencé il y a 10 min, pour l'accompagnant `caregiverId`. */
async function visitFor(caregiverId: string, aineId: string, familyUserId: string, opId: string) {
  const request = await createRequest({ aineId, createdById: familyUserId, level: 1, slots: [[1, "MATIN"]] });
  await prisma.careRequest.update({ where: { id: request.id }, data: { status: "POURVUE" } });
  const proposal = await prisma.missionProposal.create({
    data: { requestId: request.id, caregiverId, proposedById: opId, status: "ACCEPTEE", respondedAt: new Date() },
  });
  const mission = await prisma.mission.create({ data: { requestId: request.id, proposalId: proposal.id, aineId, caregiverId, hourlyRateCents: 1500 } });
  const start = new Date(Date.now() - 10 * 60_000);
  return prisma.visit.create({ data: { missionId: mission.id, aineId, caregiverId, scheduledStart: start, scheduledEnd: new Date(start.getTime() + H) } });
}

test.describe("API v1 — visites, événements, propositions", () => {
  const start = new Date();

  test.afterAll(async () => {
    await cleanupE2E();
    const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (demo) {
      await prisma.appEvent.deleteMany({ where: { userId: demo.id, receivedAt: { gte: start } } });
      await prisma.auditLog.deleteMany({ where: { actorId: demo.id, createdAt: { gte: start } } });
      await prisma.refreshToken.deleteMany({ where: { userId: demo.id, createdAt: { gte: start } } });
    }
    await prisma.$disconnect();
  });

  test("connexion accompagnant démo → visites → check-in → Kayé → propositions ; IDOR = 404", async ({ request }) => {
    const demo = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL }, select: { caregiverProfile: { select: { id: true, validation: true } } } });
    const demoProfile = demo.caregiverProfile!;
    expect(demoProfile.validation).toBe("VALIDE");
    const opId = await operatorId();
    const { user: family, aine } = await createFamilyWithAine({ aineFirstName: "Ginette", commune: "LAMENTIN" });
    const visit = await visitFor(demoProfile.id, aine.id, family.id, opId);
    const other = await createCaregiver({ firstName: "Autre", status: "SALARIE_FAMILLE_CESU", validation: "VALIDE", communes: ["LAMENTIN"], avail: [[1, "MATIN"]] });
    const otherVisit = await visitFor(other.profile.id, aine.id, family.id, opId);
    const reqRefus = await createRequest({ aineId: aine.id, createdById: family.id, level: 1, slots: [[2, "MATIN"]] });
    const reqAccept = await createRequest({ aineId: aine.id, createdById: family.id, level: 1, slots: [[4, "APRES_MIDI"]] });
    await prisma.careRequest.updateMany({ where: { id: { in: [reqRefus.id, reqAccept.id] } }, data: { status: "PROPOSEE" } });
    const pRefus = await prisma.missionProposal.create({ data: { requestId: reqRefus.id, caregiverId: demoProfile.id, proposedById: opId } });
    const pAccept = await prisma.missionProposal.create({ data: { requestId: reqAccept.id, caregiverId: demoProfile.id, proposedById: opId } });

    // 1. Connexion.
    const tokens = await login(request);
    const auth = { Authorization: `Bearer ${tokens.jetonAcces}` };

    // 2. Visites des 7 jours : la visite de test, sans code du domicile.
    const listRes = await request.get("/api/v1/visites?jours=7", { headers: auth });
    expect(listRes.status()).toBe(200);
    expect(listRes.headers()["cache-control"]).toContain("no-store");
    const list = reponseVisitesSchema.parse(await listRes.json());
    const mine = list.visites.find((v) => v.id === visit.id);
    expect(mine).toMatchObject({ statut: "PREVUE", aine: { prenom: "Ginette", communeLibelle: "Le Lamentin" }, actions: { checkIn: true } });
    expect(list.visites.map((v) => v.id)).not.toContain(otherVisit.id);
    expect(JSON.stringify(list)).not.toContain(aine.homeCode);

    // 3. IDOR : la visite d'un autre accompagnant répond 404, comme une visite inconnue.
    const idor = await request.get(`/api/v1/visites/${otherVisit.id}`, { headers: auth });
    expect(idor.status()).toBe(404);
    expect(reponseErreurSchema.parse(await idor.json()).erreur.code).toBe("INTROUVABLE");
    expect((await request.get(`/api/v1/visites/${visit.id}`, { headers: auth })).status()).toBe(200);

    // 4. Check-in par code (lot hors ligne), renvoyé deux fois : un seul check-in.
    const checkIn = { clientEventId: randomUUID(), type: "CHECK_IN", survenuA: new Date().toISOString(), visiteId: visit.id, codeDomicile: aine.homeCode };
    const idorEvent = { clientEventId: randomUUID(), type: "CHECK_IN", survenuA: new Date().toISOString(), visiteId: otherVisit.id, codeDomicile: aine.homeCode };
    const ev1 = reponseEvenementsSchema.parse(await (await request.post("/api/v1/evenements", { headers: auth, data: { evenements: [checkIn, idorEvent] } })).json());
    expect(ev1.resultats[0]).toMatchObject({ statut: "ACCEPTE", visite: { id: visit.id, statut: "EN_COURS", score: 1 } });
    expect(ev1.resultats[1]).toMatchObject({ statut: "REFUSE", motif: "INTROUVABLE" });
    const ev2 = reponseEvenementsSchema.parse(await (await request.post("/api/v1/evenements", { headers: auth, data: { evenements: [checkIn] } })).json());
    expect(ev2.resultats[0]).toMatchObject({ statut: "DOUBLON", statutOrigine: "ACCEPTE" });
    expect(await prisma.visitProof.count({ where: { visitId: visit.id } })).toBe(1);
    expect(await prisma.visitProof.count({ where: { visitId: otherVisit.id } })).toBe(0);

    // 5. Kayé : brouillon synchronisé, puis publication.
    const draft = { clientEventId: randomUUID(), type: "KAYE_BROUILLON", survenuA: new Date().toISOString(), visiteId: visit.id, kaye: { humeur: 4 } };
    await request.post("/api/v1/evenements", { headers: auth, data: { evenements: [draft] } });
    const detail = reponseVisiteSchema.parse(await (await request.get(`/api/v1/visites/${visit.id}`, { headers: auth })).json());
    expect(detail.brouillonKaye).toEqual({ humeur: 4 });
    const publish = {
      clientEventId: randomUUID(),
      type: "KAYE_PUBLICATION",
      survenuA: new Date().toISOString(),
      visiteId: visit.id,
      kaye: { humeur: 4, appetit: "BON", activites: ["Dominos"], note: "Belle après-midi (test e2e).", aSurveiller: false },
    };
    const pub = reponseEvenementsSchema.parse(await (await request.post("/api/v1/evenements", { headers: auth, data: { evenements: [publish] } })).json());
    expect(pub.resultats[0]).toMatchObject({ statut: "ACCEPTE" });
    const afterKaye = reponseVisiteSchema.parse(await (await request.get(`/api/v1/visites/${visit.id}`, { headers: auth })).json());
    expect(afterKaye).toMatchObject({ kayePublie: true, brouillonKaye: null });

    // 6. Propositions : liste, refus sans pénalité, acceptation.
    const props = reponsePropositionsSchema.parse(await (await request.get("/api/v1/propositions", { headers: auth })).json());
    expect(props.propositions.map((p) => p.id)).toEqual(expect.arrayContaining([pRefus.id, pAccept.id]));
    const refus = await request.post(`/api/v1/propositions/${pRefus.id}/refuser`, { headers: auth, data: { note: "Pas disponible (test e2e)." } });
    expect(refus.status()).toBe(200);
    expect(reponseRefusSchema.parse(await refus.json())).toEqual({ statut: "REFUSEE", sansPenalite: true });
    const again = await request.post(`/api/v1/propositions/${pRefus.id}/refuser`, { headers: auth });
    expect(again.status()).toBe(409);
    const accept = await request.post(`/api/v1/propositions/${pAccept.id}/accepter`, { headers: auth });
    expect(accept.status()).toBe(200);
    expect(reponseAcceptationSchema.parse(await accept.json()).visitesCreees).toBeGreaterThan(0);
    const after = await prisma.caregiverProfile.findUniqueOrThrow({ where: { id: demoProfile.id }, select: { validation: true } });
    expect(after.validation).toBe("VALIDE");
  });
});
