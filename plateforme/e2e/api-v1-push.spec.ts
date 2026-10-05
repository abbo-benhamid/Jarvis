import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { reponseAppareilSchema, reponseCodeSchema, reponseEvenementsSchema, reponseJetonsSchema } from "../src/contracts/v1";
import { DEMO_PASSWORD, E2E_PASSWORD, cleanupE2E, createFamilyWithAine, createRequest, operatorId, prisma } from "./fixtures";

/**
 * Lot N1 (push) : enregistrer l'appareil de la famille → l'accompagnant démo publie un Kayé « à surveiller »
 * → deux push génériques (R9) partent vers l'appareil par l'adaptateur `console` (ADAPTER_PUSH absent).
 * Le journal du serveur montre : « [push:console] ANDROID …xxxx | Nouveau Kayé pour Ginette | … ».
 * Puis l'app retire l'appareil (DELETE) : plus de push.
 */
const DEMO_EMAIL = "accompagnant@demo.koudmen.test";
const H = 3_600_000;

async function login(request: APIRequestContext, body: Record<string, unknown>) {
  const verifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
  const codeRes = await request.post("/api/v1/auth/code", { data: { ...body, codeChallenge } });
  expect(codeRes.status()).toBe(200);
  const { code } = reponseCodeSchema.parse(await codeRes.json());
  const tokenRes = await request.post("/api/v1/auth/token", { data: { code, codeVerifier: verifier } });
  expect(tokenRes.status()).toBe(200);
  const t = reponseJetonsSchema.parse(await tokenRes.json());
  return { Authorization: `Bearer ${t.jetonAcces}` };
}

test.describe("API v1 — push (lot N1)", () => {
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

  test("appareil de la famille → Kayé publié → push générique ; retrait → plus de push", async ({ request }) => {
    const demo = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL }, select: { caregiverProfile: { select: { id: true } } } });
    const opId = await operatorId();
    const { user: family, aine } = await createFamilyWithAine({ aineFirstName: "Ginette", commune: "LAMENTIN" });
    const req = await createRequest({ aineId: aine.id, createdById: family.id, level: 1, slots: [[1, "MATIN"]] });
    await prisma.careRequest.update({ where: { id: req.id }, data: { status: "POURVUE" } });
    const proposal = await prisma.missionProposal.create({
      data: { requestId: req.id, caregiverId: demo.caregiverProfile!.id, proposedById: opId, status: "ACCEPTEE", respondedAt: new Date() },
    });
    const mission = await prisma.mission.create({
      data: { requestId: req.id, proposalId: proposal.id, aineId: aine.id, caregiverId: demo.caregiverProfile!.id, hourlyRateCents: 1500 },
    });
    const visitStart = new Date(Date.now() - 10 * 60_000);
    const visit = await prisma.visit.create({
      data: { missionId: mission.id, aineId: aine.id, caregiverId: demo.caregiverProfile!.id, scheduledStart: visitStart, scheduledEnd: new Date(visitStart.getTime() + H) },
    });

    // 1. La famille se connecte dans l'app et enregistre son appareil.
    const familyAuth = await login(request, { methode: "mot_de_passe", email: family.email, motDePasse: E2E_PASSWORD });
    const jeton = `ExponentPushToken[e2e${randomBytes(8).toString("hex")}]`;
    const bad = await request.post("/api/v1/appareils", { headers: familyAuth, data: { jeton: "pas-un-jeton", plateforme: "ANDROID" } });
    expect(bad.status()).toBe(400);
    const reg = await request.post("/api/v1/appareils", { headers: familyAuth, data: { jeton, plateforme: "ANDROID" } });
    expect(reg.status()).toBe(200);
    const device = reponseAppareilSchema.parse(await reg.json());

    // 2. L'accompagnant démo fait le check-in puis publie un Kayé « à surveiller ».
    const cgAuth = await login(
      request,
      DEMO_PASSWORD ? { methode: "mot_de_passe", email: DEMO_EMAIL, motDePasse: DEMO_PASSWORD } : { methode: "demo", role: "ACCOMPAGNANT" },
    );
    const now = () => new Date().toISOString();
    const evs = [
      { clientEventId: randomUUID(), type: "CHECK_IN", survenuA: now(), visiteId: visit.id, codeDomicile: aine.homeCode },
      {
        clientEventId: randomUUID(),
        type: "KAYE_PUBLICATION",
        survenuA: now(),
        visiteId: visit.id,
        kaye: { humeur: 2, appetit: "FAIBLE", activites: ["Dominos"], note: "Texte privé du Kayé (e2e).", aSurveiller: true, noteSurveillance: "Détail privé (e2e)." },
      },
    ];
    const res = reponseEvenementsSchema.parse(await (await request.post("/api/v1/evenements", { headers: cgAuth, data: { evenements: evs } })).json());
    expect(res.resultats.map((r) => r.statut)).toEqual(["ACCEPTE", "ACCEPTE"]);

    // 3. Deux push dans l'Outbox, envoyés APRÈS la réponse (M2 : console = ENVOYE_SIMULE), titre générique (X2).
    const pushRows = () => prisma.outboxMessage.findMany({ where: { recipientUserId: family.id, channel: "PUSH" }, orderBy: { createdAt: "asc" } });
    await expect
      .poll(async () => (await pushRows()).map((p) => [p.template, p.status, p.to, p.subject]))
      .toEqual([
        ["KAYE_PUBLIE", "ENVOYE_SIMULE", "1/1 appareil(s)", "Koudmen · Nouvelles de votre proche"],
        ["ALERTE_A_SURVEILLER", "ENVOYE_SIMULE", "1/1 appareil(s)", "Koudmen · Nouvelles de votre proche"],
      ]);
    for (const p of await pushRows()) expect(`${p.subject} ${p.body}`).not.toMatch(/privé|Dominos|FAIBLE|Ginette|surveiller/);
    // Le canal par défaut (e-mail : pas de téléphone) part toujours.
    expect(await prisma.outboxMessage.count({ where: { recipientUserId: family.id, channel: "EMAIL", template: "KAYE_PUBLIE" } })).toBe(1);

    // 4. L'app retire l'appareil (avant la déconnexion) : idempotent, et plus aucun push.
    expect((await request.delete(`/api/v1/appareils/${device.id}`, { headers: familyAuth })).status()).toBe(204);
    expect((await request.delete(`/api/v1/appareils/${device.id}`, { headers: familyAuth })).status()).toBe(204);
    expect(await prisma.pushDevice.findUniqueOrThrow({ where: { id: device.id } })).toMatchObject({ revokedReason: "RETIRE" });
  });
});
