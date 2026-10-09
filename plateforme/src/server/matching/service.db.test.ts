import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Flux D6 sur une VRAIE base, en parallèle (m1, m8) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/matching/service.db.test.ts
 * Chaque test crée un MONDE de bac à sable (sandboxId) : tout est effacé par purgeSandboxIds à la fin.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

describe.runIf(enabled)("matching, annulation et suspension sur une vraie base", async () => {
  const { db } = await import("@/server/db");
  const matching = await import("./service");
  const accompagnant = await import("@/server/accompagnant/service");
  const { canAccessAine } = await import("@/server/access");
  const { purgeSandboxIds } = await import("@/server/sandbox/purge");
  const sandboxes: string[] = [];

  afterAll(async () => {
    await purgeSandboxIds(db, sandboxes);
    await db.$disconnect();
  });

  /** Monde minimal : 1 opérateur robot, 1 famille + aîné, n accompagnants VALIDES compatibles. */
  async function world(n: number) {
    const sb = await db.sandbox.create({
      data: { testerCode: "DBTEST-MATCHING", role: "FAMILLE", resumeTokenHash: `t-${randomBytes(8).toString("hex")}`, cguAcceptedAt: new Date() },
    });
    sandboxes.push(sb.id);
    const tag = randomBytes(4).toString("hex");
    const mk = (role: "FAMILLE" | "ACCOMPAGNANT" | "OPERATEUR", firstName: string) =>
      db.user.create({
        data: { email: `${firstName.toLowerCase()}-${tag}@bac-a-sable.koudmen.test`, passwordHash: "x", role, firstName, lastName: "Test", sandboxId: sb.id },
      });
    const operator = await mk("OPERATEUR", "Robot");
    const family = await mk("FAMILLE", "Nadia");
    const aine = await db.aine.create({
      data: {
        firstName: "Ernest",
        territoire: "GUADELOUPE",
        commune: "LAMENTIN_GP",
        latitude: 16.27,
        longitude: -61.63,
        activityLevel: 2,
        consentGiven: true,
        accordEtat: "ACCORD_RECUEILLI",
        consentByType: "AINE",
        consentByName: "Test",
        consentAt: new Date(),
        homeCode: `Q${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`,
        ownerId: family.id,
        sandboxId: sb.id,
        members: { create: { userId: family.id, relation: "fille", isPayer: true } },
      },
    });
    const caregivers = [];
    for (let i = 0; i < n; i++) {
      const u = await mk("ACCOMPAGNANT", `Cg${i}`);
      const p = await db.caregiverProfile.create({
        data: {
          userId: u.id,
          status: "SALARIE_FAMILLE_CESU",
          allowedLevels: [1, 2, 3],
          territoire: "GUADELOUPE",
          communes: ["LAMENTIN_GP"],
          hourlyRateCents: 1500,
          validation: "VALIDE",
          availabilities: { create: [{ dayOfWeek: 1, slot: "APRES_MIDI" }] },
        },
      });
      caregivers.push({ user: u, profile: p, actor: { id: u.id, role: u.role, firstName: u.firstName } });
    }
    const request = (status: "OUVERTE" | "PROPOSEE" = "OUVERTE") =>
      db.careRequest.create({
        data: {
          aineId: aine.id,
          createdById: family.id,
          level: 2,
          frequency: "HEBDOMADAIRE",
          durationMinutes: 90,
          status,
          notes: "Aime les dominos.",
          slots: { create: [{ dayOfWeek: 1, slot: "APRES_MIDI" }] },
        },
      });
    return { sandboxId: sb.id, operator, family, aine, caregivers, request };
  }

  it("T1 (T3) : jamais un profil d'un autre territoire ; jamais une demande d'un territoire pas encore ouvert", async () => {
    const w = await world(2);
    const r = await w.request();
    // Accompagnant de Martinique (données antérieures à T1) : refusé pour un aîné de Guadeloupe.
    await db.caregiverProfile.update({ where: { id: w.caregivers[0]!.profile.id }, data: { territoire: "MARTINIQUE", communes: ["LAMENTIN"] } });
    await expect(matching.proposeProfile(w.operator, { requestId: r.id, caregiverId: w.caregivers[0]!.profile.id }, w.sandboxId)).rejects.toThrow(
      "Autre territoire",
    );
    // Aîné et accompagnant de Martinique : même territoire, mais pas encore ouvert.
    await db.aine.update({ where: { id: w.aine.id }, data: { territoire: "MARTINIQUE", commune: "LAMENTIN" } });
    await expect(matching.proposeProfile(w.operator, { requestId: r.id, caregiverId: w.caregivers[0]!.profile.id }, w.sandboxId)).rejects.toThrow(
      "Territoire pas encore ouvert",
    );
    expect(await db.missionProposal.count({ where: { requestId: r.id } })).toBe(0);
  });

  it("max 3 profils : 4 propositions simultanées → exactement 3 réussissent", async () => {
    const w = await world(4);
    const r = await w.request();
    const results = await Promise.allSettled(
      w.caregivers.map((c) => matching.proposeProfile(w.operator, { requestId: r.id, caregiverId: c.profile.id }, w.sandboxId)),
    );
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(3);
    const rejected = results.filter((x): x is PromiseRejectedResult => x.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(matching.MatchingError);
    expect(await db.missionProposal.count({ where: { requestId: r.id, status: "PROPOSEE_FAMILLE" } })).toBe(3);
  });

  it("un seul profil choisi : 3 choix simultanés → exactement 1 EN_ATTENTE, 1 seul accompagnant prévenu", async () => {
    const w = await world(3);
    const r = await w.request();
    const ids = [];
    for (const c of w.caregivers) ids.push((await matching.proposeProfile(w.operator, { requestId: r.id, caregiverId: c.profile.id }, w.sandboxId)).proposalId);
    const results = await Promise.allSettled(ids.map((id) => matching.chooseProfile(w.family, id)));
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    for (const x of results) if (x.status === "rejected") expect(x.reason).toBeInstanceOf(matching.MatchingError);
    expect(await db.missionProposal.count({ where: { requestId: r.id, status: "EN_ATTENTE" } })).toBe(1);
    expect(await db.outboxMessage.count({ where: { sandboxId: w.sandboxId, template: "PROPOSITION_MISSION" } })).toBe(1);
  });

  it("A1 : un profil suspendu n'est plus choisissable", async () => {
    const w = await world(1);
    const r = await w.request();
    const { proposalId } = await matching.proposeProfile(w.operator, { requestId: r.id, caregiverId: w.caregivers[0]!.profile.id }, w.sandboxId);
    await db.caregiverProfile.update({ where: { id: w.caregivers[0]!.profile.id }, data: { validation: "SUSPENDU" } });
    await expect(matching.chooseProfile(w.family, proposalId)).rejects.toThrow("n'est plus disponible");
  });

  it("m1 : deux acceptations simultanées de deux propositions → une mission, un CONFLIT clair, aucun deadlock", async () => {
    const w = await world(2);
    const r = await w.request("PROPOSEE");
    const props = await Promise.all(
      w.caregivers.map((c) => db.missionProposal.create({ data: { requestId: r.id, caregiverId: c.profile.id, proposedById: w.operator.id, status: "EN_ATTENTE" } })),
    );
    const results = await Promise.allSettled(props.map((p, i) => accompagnant.acceptProposal(w.caregivers[i]!.actor, p.id)));
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((x): x is PromiseRejectedResult => x.status === "rejected")!;
    expect(lost.reason).toBeInstanceOf(accompagnant.AccompagnantError);
    expect(await db.mission.count({ where: { requestId: r.id } })).toBe(1);
  });

  it("M5 : annulation et acceptation simultanées → jamais une demande ANNULEE avec une mission", async () => {
    for (let round = 0; round < 3; round++) {
      const w = await world(2);
      const r = await w.request("PROPOSEE");
      const chosen = await db.missionProposal.create({
        data: { requestId: r.id, caregiverId: w.caregivers[0]!.profile.id, proposedById: w.operator.id, status: "EN_ATTENTE", chosenById: w.family.id },
      });
      await db.missionProposal.create({ data: { requestId: r.id, caregiverId: w.caregivers[1]!.profile.id, proposedById: w.operator.id, status: "PROPOSEE_FAMILLE" } });
      const [cancel, accept] = await Promise.allSettled([
        matching.cancelCareRequest(w.family, r.id),
        accompagnant.acceptProposal(w.caregivers[0]!.actor, chosen.id),
      ]);
      const after = await db.careRequest.findUniqueOrThrow({ where: { id: r.id }, include: { mission: true, proposals: true } });
      if (cancel.status === "fulfilled") {
        expect(accept.status).toBe("rejected");
        expect(after.status).toBe("ANNULEE");
        expect(after.mission).toBeNull();
        // PROPOSEE_FAMILLE et EN_ATTENTE annulées ; l'accompagnant choisi est prévenu.
        expect(after.proposals.every((p) => p.status === "ANNULEE")).toBe(true);
        expect(await db.outboxMessage.count({ where: { recipientUserId: w.caregivers[0]!.user.id, template: "DEMANDE_ANNULEE" } })).toBe(1);
      } else {
        expect(accept.status).toBe("fulfilled");
        expect(after.status).toBe("POURVUE");
        expect(after.mission).not.toBeNull();
      }
    }
  });

  it("A1 : suspension → propositions annulées, mission SUSPENDUE, visites futures annulées, demande rouverte, famille prévenue", async () => {
    const w = await world(2);
    const [a, b] = w.caregivers;
    // req1 : A et B proposés (à choisir). req2 : A choisi. req3 : A a une mission active.
    const req1 = await w.request();
    await matching.proposeProfile(w.operator, { requestId: req1.id, caregiverId: a!.profile.id }, w.sandboxId);
    await matching.proposeProfile(w.operator, { requestId: req1.id, caregiverId: b!.profile.id }, w.sandboxId);
    const req2 = await w.request();
    const p2 = await matching.proposeProfile(w.operator, { requestId: req2.id, caregiverId: a!.profile.id }, w.sandboxId);
    await matching.chooseProfile(w.family, p2.proposalId);
    const req3 = await w.request();
    const p3 = await matching.proposeProfile(w.operator, { requestId: req3.id, caregiverId: a!.profile.id }, w.sandboxId);
    await matching.chooseProfile(w.family, p3.proposalId);
    const accepted = await accompagnant.acceptProposal(a!.actor, p3.proposalId);
    expect(accepted.visitCount).toBeGreaterThan(0);
    const past = await db.visit.create({
      data: {
        missionId: accepted.missionId,
        aineId: w.aine.id,
        caregiverId: a!.profile.id,
        scheduledStart: new Date(Date.now() - 3 * 86_400_000),
        scheduledEnd: new Date(Date.now() - 3 * 86_400_000 + 3_600_000),
        checkInAt: new Date(Date.now() - 3 * 86_400_000),
        status: "VALIDEE",
      },
    });

    const released = await db.$transaction(async (tx) => {
      await tx.caregiverProfile.update({ where: { id: a!.profile.id }, data: { validation: "SUSPENDU" } });
      return matching.releaseCaregiver(tx, a!.profile.id, w.operator);
    });
    expect(released).toMatchObject({ cancelledProposals: 2, suspendedMissions: 1, cancelledVisits: accepted.visitCount });

    // req1 : B reste à choisir, la demande reste PROPOSEE. req2 : plus rien → OUVERTE.
    expect((await db.careRequest.findUniqueOrThrow({ where: { id: req1.id } })).status).toBe("PROPOSEE");
    expect(await db.missionProposal.count({ where: { requestId: req1.id, status: "PROPOSEE_FAMILLE" } })).toBe(1);
    expect((await db.careRequest.findUniqueOrThrow({ where: { id: req2.id } })).status).toBe("OUVERTE");
    // req3 : mission SUSPENDUE, visites futures effacées, visite passée gardée, ancienne demande ANNULEE + copie OUVERTE.
    const mission = await db.mission.findUniqueOrThrow({ where: { id: accepted.missionId }, include: { visits: true } });
    expect(mission.status).toBe("SUSPENDUE");
    expect(mission.visits.map((v) => v.id)).toEqual([past.id]);
    expect((await db.careRequest.findUniqueOrThrow({ where: { id: req3.id } })).status).toBe("ANNULEE");
    const reopened = await db.careRequest.findMany({ where: { aineId: w.aine.id, status: "OUVERTE", id: { notIn: [req2.id] } }, include: { slots: true } });
    expect(reopened).toHaveLength(1);
    expect(reopened[0]).toMatchObject({ level: 2, frequency: "HEBDOMADAIRE", durationMinutes: 90, notes: "Aime les dominos." });
    expect(reopened[0]!.slots).toHaveLength(1);
    expect(await db.outboxMessage.count({ where: { recipientUserId: w.family.id, template: "MISSION_SUSPENDUE" } })).toBe(1);
    expect(await db.outboxMessage.count({ where: { recipientUserId: w.family.id, template: "PROFIL_INDISPONIBLE" } })).toBe(2);

    // Plus d'accès à l'aîné, plus de check-in ni de Kayé (même sur la visite passée).
    expect(await canAccessAine(a!.actor, w.aine.id)).toBe(false);
    await expect(accompagnant.checkInWithGps(a!.actor, { visitId: past.id, simulated: true })).rejects.toMatchObject({ code: "INTERDIT" });
    await expect(
      accompagnant.createKaye(a!.actor, { visitId: past.id, mood: 4, appetite: "BON", activities: [], note: null, alertFlag: false, alertNote: null }),
    ).rejects.toMatchObject({ code: "INTERDIT" });
    // La famille peut choisir B sur req1 ; Koudmen peut proposer d'autres profils sur la demande rouverte.
    const pB = await db.missionProposal.findFirstOrThrow({ where: { requestId: req1.id, caregiverId: b!.profile.id } });
    await expect(matching.chooseProfile(w.family, pB.id)).resolves.toMatchObject({ requestId: req1.id });
    await expect(matching.proposeProfile(w.operator, { requestId: reopened[0]!.id, caregiverId: b!.profile.id }, w.sandboxId)).resolves.toBeDefined();
  });

  it("D10 (M1) : réorientation vers salarié après un tarif libre sous le SMIC → tarif effacé, vérification impossible", async () => {
    const w = await world(1);
    const c = w.caregivers[0]!;
    await db.caregiverProfile.update({ where: { id: c.profile.id }, data: { status: "AUTO_ENTREPRENEUR_SAP", hourlyRateCents: 900, validation: "BROUILLON" } });
    const r = await accompagnant.saveOrientation(c.actor, {
      activity: "PRESENCE",
      paid: true,
      existingStatus: "AUCUN",
      situations: [],
      familyLink: "AUCUN",
    });
    expect(r.status).toBe("SALARIE_FAMILLE_CESU");
    const after = await db.caregiverProfile.findUniqueOrThrow({ where: { id: c.profile.id } });
    expect(after.hourlyRateCents).toBeNull();
    await expect(accompagnant.submitForReview(c.actor)).rejects.toThrow(/tarif/);
  });
});
