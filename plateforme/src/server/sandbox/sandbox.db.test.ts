import { afterAll, describe, expect, it } from "vitest";

/**
 * Test d'INTÉGRATION sur une vraie base PostgreSQL (opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/sandbox/sandbox.db.test.ts
 * Il crée 2 bacs à sable, vérifie le CLOISONNEMENT (D2), joue les robots (D14) puis purge.
 * Il ne touche pas aux données de démo.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

describe.runIf(enabled)("bacs à sable sur une vraie base", async () => {
  const { db } = await import("@/server/db");
  const world = await import("./world");
  const robots = await import("./robots");
  const purge = await import("./purge");
  const operateur = await import("@/server/operateur/queries");
  const matching = await import("@/server/matching/service");
  const { chooseProfile } = matching;

  const ids: string[] = [];
  async function sandbox(role: "FAMILLE" | "ACCOMPAGNANT") {
    const s = await db.sandbox.create({
      data: { testerCode: "DBTEST", role, resumeTokenHash: `test-${Math.random()}`, cguAcceptedAt: new Date() },
    });
    ids.push(s.id);
    const { testerUserId } =
      role === "FAMILLE" ? await world.buildFamilyWorld(s.id, { firstName: "Nadia" }) : await world.buildCaregiverWorld(s.id, { firstName: "Ghislaine" });
    const tester = await db.user.findUniqueOrThrow({ where: { id: testerUserId } });
    return { sandboxId: s.id, tester: { id: tester.id, role: role, firstName: tester.firstName, sandboxId: s.id } };
  }

  afterAll(async () => {
    await purge.purgeSandboxIds(db, ids);
    await db.$disconnect();
  });

  it("famille : propose 3 profils compatibles du MÊME monde, la famille choisit, visite prouvée et Kayé", async () => {
    const a = await sandbox("FAMILLE");
    const b = await sandbox("FAMILLE");

    // 1. Les robots proposent : seulement des profils du bac à sable A.
    const r1 = await robots.simulateNext(a.tester);
    expect(r1.step).toBe("PROFILS_PROPOSES");
    const proposals = await db.missionProposal.findMany({
      where: { request: { aine: { sandboxId: a.sandboxId } }, status: "PROPOSEE_FAMILLE" },
      include: { caregiver: { include: { user: true } } },
    });
    expect(proposals).toHaveLength(3);
    for (const p of proposals) expect(p.caregiver.user.sandboxId).toBe(a.sandboxId);
    // D7 : la proche aidante n'est jamais proposée ; l'auto-entrepreneur n'est pas proposé au niveau 1.
    expect(proposals.map((p) => p.caregiver.status)).not.toContain("PROCHE_AIDANT_APA");
    expect(proposals.map((p) => p.caregiver.status)).not.toContain("AUTO_ENTREPRENEUR_SAP");

    // 2. Sans choix de la famille, les robots attendent (D6 : Koudmen ne choisit pas).
    expect((await robots.simulateNext(a.tester)).step).toBe("ATTENTE_CHOIX_FAMILLE");
    await chooseProfile(a.tester, proposals[0]!.id);

    // 3. L'accompagnant robot accepte ; 4. visite 2 sur 3 + Kayé.
    expect((await robots.simulateNext(a.tester)).step).toBe("ACCOMPAGNANT_ACCEPTE");
    const r4 = await robots.simulateNext(a.tester);
    expect(r4.step).toBe("VISITE_ET_KAYE");
    const kaye = await db.journalEntry.findFirst({ where: { aine: { sandboxId: a.sandboxId } }, orderBy: { createdAt: "desc" }, include: { visit: true } });
    expect(kaye?.visit.status).toBe("VALIDEE");
    expect(kaye?.visit.proofScore).toBe(2);

    // Le bac à sable B n'a rien reçu.
    expect(await db.missionProposal.count({ where: { request: { aine: { sandboxId: b.sandboxId } }, createdAt: { gte: new Date(Date.now() - 60_000) } } })).toBe(0);
  });

  it("cloisonnement : un profil d'un autre bac à sable est refusé, l'opérateur réel ne voit aucun bac à sable", async () => {
    const a = await sandbox("FAMILLE");
    const b = await sandbox("FAMILLE");
    const reqA = await db.careRequest.findFirstOrThrow({ where: { aine: { sandboxId: a.sandboxId }, status: "OUVERTE" } });
    const cgB = await db.caregiverProfile.findFirstOrThrow({ where: { user: { sandboxId: b.sandboxId }, status: "SALARIE_FAMILLE_CESU" } });
    const robotA = await db.user.findFirstOrThrow({ where: { sandboxId: a.sandboxId, role: "OPERATEUR" } });
    await expect(matching.proposeProfile(robotA, { requestId: reqA.id, caregiverId: cgB.id }, a.sandboxId)).rejects.toThrow("introuvable");
    // Même avec le bon monde pour la demande, l'opérateur réel (monde réel) ne peut rien proposer dans un bac à sable.
    await expect(matching.proposeProfile(robotA, { requestId: reqA.id, caregiverId: cgB.id }, null)).rejects.toThrow("introuvable");

    // Espace opérateur : aucune donnée de bac à sable.
    const caregivers = await operateur.listCaregivers({});
    const sandboxCaregivers = await db.caregiverProfile.findMany({ where: { user: { sandboxId: { in: [a.sandboxId, b.sandboxId] } } }, select: { id: true } });
    const visible = new Set(caregivers.map((c) => c.id));
    for (const c of sandboxCaregivers) expect(visible.has(c.id)).toBe(false);
    const open = await operateur.listOpenRequests();
    expect(open.some((r) => r.id === reqA.id)).toBe(false);
    expect(await operateur.getRequestWithCandidates(reqA.id)).toBeNull();
    const visits = await operateur.listVisits({});
    const sandboxAines = await db.aine.findMany({ where: { sandboxId: { in: [a.sandboxId, b.sandboxId] } }, select: { firstName: true, id: true } });
    expect(visits.length).toBeGreaterThanOrEqual(0);
    const visitAineIds = await db.visit.findMany({ where: { id: { in: visits.map((v) => v.id) } }, select: { aineId: true } });
    for (const v of visitAineIds) expect(sandboxAines.map((x) => x.id)).not.toContain(v.aineId);
    const outbox = await operateur.listOutbox({});
    expect(outbox.every((m) => m.sandboxId === null)).toBe(true);
  });

  it("accompagnant : le robot complète, valide, une famille robot choisit, la visite commence, puis la famille lit le Kayé", async () => {
    const c = await sandbox("ACCOMPAGNANT");
    expect((await robots.simulateNext(c.tester)).step).toBe("ATTENTE_ORIENTATION");
    // Orientation minimale : statut salarié.
    await db.caregiverProfile.update({
      where: { userId: c.tester.id },
      data: { status: "SALARIE_FAMILLE_CESU", allowedLevels: [1, 2, 3], verifications: { create: [{ type: "IDENTITE" }, { type: "CASIER_B3" }] } },
    });
    expect((await robots.simulateNext(c.tester)).step).toBe("PROFIL_ENVOYE");
    expect((await robots.simulateNext(c.tester)).step).toBe("PROFIL_VALIDE");
    expect((await robots.simulateNext(c.tester)).step).toBe("FAMILLE_CHOISIT");
    expect((await robots.simulateNext(c.tester)).step).toBe("ATTENTE_REPONSE");
    const proposal = await db.missionProposal.findFirstOrThrow({ where: { caregiver: { userId: c.tester.id }, status: "EN_ATTENTE" } });
    const { acceptProposal } = await import("@/server/accompagnant/service");
    await acceptProposal(c.tester, proposal.id);
    const r = await robots.simulateNext(c.tester);
    expect(r.step).toBe("VISITE_COMMENCE");
    expect(r.message).toMatch(/code du domicile : [A-Z0-9]{6}/);
  });

  it("purge : efface tout le monde du bac à sable, garde les avis anonymisés", async () => {
    const s = await sandbox("FAMILLE");
    await db.feedback.create({ data: { rating: 4, message: "[DBTEST] avis", pagePath: "/", sandboxId: s.sandboxId, testerCode: "DBTEST" } });
    await purge.purgeSandboxIds(db, [s.sandboxId]);
    expect(await db.user.count({ where: { sandboxId: s.sandboxId } })).toBe(0);
    expect(await db.aine.count({ where: { sandboxId: s.sandboxId } })).toBe(0);
    const fb = await db.feedback.findFirstOrThrow({ where: { message: "[DBTEST] avis" } });
    expect(fb.sandboxId).toBeNull();
    expect(fb.testerCode).toBe("DBTEST");
    await db.feedback.delete({ where: { id: fb.id } });
  });
});
