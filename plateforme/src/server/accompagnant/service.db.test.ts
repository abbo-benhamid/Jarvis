import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * Test d'INTÉGRATION sur une vraie base PostgreSQL (opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/accompagnant/service.db.test.ts
 * Il crée ses propres données (préfixe unique), puis les supprime. Il ne touche pas aux données de démo.
 * Désactivé par défaut : en CI, les tests unitaires tournent avant la migration de la base.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

describe.runIf(enabled)("Lot B sur une vraie base", async () => {
  const { db } = await import("@/server/db");
  const service = await import("./service");
  const tag = `lotb-${randomBytes(4).toString("hex")}`;
  const userIds: string[] = [];
  const aineIds: string[] = [];

  async function user(role: "FAMILLE" | "ACCOMPAGNANT" | "OPERATEUR", firstName: string) {
    const u = await db.user.create({
      data: { email: `${firstName.toLowerCase()}-${tag}@test.koudmen.test`, passwordHash: "x", role, firstName, lastName: "Test" },
    });
    userIds.push(u.id);
    return u;
  }
  async function caregiver(firstName: string) {
    const u = await user("ACCOMPAGNANT", firstName);
    const p = await db.caregiverProfile.create({
      data: {
        userId: u.id,
        status: "SALARIE_FAMILLE_CESU",
        allowedLevels: [1, 2, 3],
        communes: ["LAMENTIN"],
        hourlyRateCents: 1650,
        validation: "VALIDE",
      },
    });
    return { actor: { id: u.id, role: u.role, firstName }, profile: p };
  }

  let famille: Awaited<ReturnType<typeof user>>;
  let operateur: Awaited<ReturnType<typeof user>>;
  let a: Awaited<ReturnType<typeof caregiver>>;
  let b: Awaited<ReturnType<typeof caregiver>>;
  let aineId: string;
  let homeCode: string;

  async function requestWithProposals() {
    const r = await db.careRequest.create({
      data: {
        aineId,
        createdById: famille.id,
        level: 2,
        frequency: "DEUX_PAR_SEMAINE",
        durationMinutes: 90,
        status: "PROPOSEE",
        slots: {
          create: [
            { dayOfWeek: 1, slot: "APRES_MIDI" },
            { dayOfWeek: 3, slot: "APRES_MIDI" },
          ],
        },
      },
    });
    const pa = await db.missionProposal.create({ data: { requestId: r.id, caregiverId: a.profile.id, proposedById: operateur.id } });
    const pb = await db.missionProposal.create({ data: { requestId: r.id, caregiverId: b.profile.id, proposedById: operateur.id } });
    return { r, pa, pb };
  }

  beforeAll(async () => {
    famille = await user("FAMILLE", "Famille");
    operateur = await user("OPERATEUR", "Operateur");
    a = await caregiver("Alice");
    b = await caregiver("Bruno");
    homeCode = `Z${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
    const aine = await db.aine.create({
      data: {
        firstName: "Aîné",
        commune: "LAMENTIN",
        latitude: 14.6131,
        longitude: -60.9996,
        activityLevel: 2,
        consentGiven: true,
        accordEtat: "ACCORD_RECUEILLI",
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
    await db.outboxMessage.deleteMany({ where: { recipientUserId: { in: userIds } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db.aine.deleteMany({ where: { id: { in: aineIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("acceptation : mission + 8 visites + autre proposition annulée + demande POURVUE + message au cercle", async () => {
    const { r, pa, pb } = await requestWithProposals();
    const res = await service.acceptProposal(a.actor, pa.id);
    expect(res.visitCount).toBe(8);
    const mission = await db.mission.findUniqueOrThrow({ where: { id: res.missionId }, include: { visits: true } });
    expect(mission.hourlyRateCents).toBe(1650);
    expect(mission.visits).toHaveLength(8);
    expect((await db.careRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("POURVUE");
    expect((await db.missionProposal.findUniqueOrThrow({ where: { id: pa.id } })).status).toBe("ACCEPTEE");
    expect((await db.missionProposal.findUniqueOrThrow({ where: { id: pb.id } })).status).toBe("ANNULEE");
    const msgs = await db.outboxMessage.findMany({ where: { recipientUserId: famille.id, template: "PROPOSITION_ACCEPTEE" } });
    expect(msgs).toHaveLength(1);
  });

  it("deux acceptations simultanées : une seule réussit, une seule mission", async () => {
    const { r, pa, pb } = await requestWithProposals();
    const results = await Promise.allSettled([service.acceptProposal(a.actor, pa.id), service.acceptProposal(b.actor, pb.id)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.mission.count({ where: { requestId: r.id } })).toBe(1);
    const visits = await db.visit.count({ where: { mission: { requestId: r.id } } });
    expect(visits).toBe(8);
  });

  it("propriété : Bruno ne peut pas faire le check-in d'une visite d'Alice", async () => {
    const visit = await db.visit.findFirstOrThrow({ where: { caregiverId: a.profile.id }, orderBy: { scheduledStart: "asc" } });
    await expect(service.checkInWithCode(b.actor, visit.id, homeCode)).rejects.toMatchObject({ code: "INTROUVABLE" });
    expect(await db.visitProof.count({ where: { visitId: visit.id } })).toBe(0);
  });

  it("check-in par code puis un seul Kayé, même avec deux envois simultanés", async () => {
    process.env.NEXT_PUBLIC_TEST_MODE = "true"; // visite future : check-in permis en mode test
    const visit = await db.visit.findFirstOrThrow({ where: { caregiverId: a.profile.id }, orderBy: { scheduledStart: "asc" } });
    await service.checkInWithCode(a.actor, visit.id, homeCode.toLowerCase());
    const after = await db.visit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(after.checkInAt).not.toBeNull();
    expect(after.proofScore).toBe(1);
    const input = { visitId: visit.id, mood: 4, appetite: "BON" as const, activities: [], note: null, alertFlag: true, alertNote: "Test" };
    const results = await Promise.allSettled([service.createKaye(a.actor, input), service.createKaye(a.actor, input)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.journalEntry.count({ where: { visitId: visit.id } })).toBe(1);
    const templates = (await db.outboxMessage.findMany({ where: { recipientUserId: famille.id, relatedId: visit.id } })).map((m) => m.template);
    expect(templates).toEqual(expect.arrayContaining(["VISITE_COMMENCEE", "KAYE_PUBLIE", "ALERTE_A_SURVEILLER"]));
    expect(templates.filter((t) => t === "KAYE_PUBLIE")).toHaveLength(1);
  });
});
