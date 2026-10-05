import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Tests de la logique métier du Lot B avec une base simulée.
 * Points critiques : transaction d'acceptation, propriété de la visite, un seul Kayé, notifications.
 */

const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findFirst: fn(),
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    createMany: fn(),
    update: fn(),
    updateMany: fn(),
    upsert: fn(),
    deleteMany: fn(),
    count: fn(),
  });
  const client = () => ({
    missionProposal: model(),
    careRequest: model(),
    mission: model(),
    visit: model(),
    caregiverProfile: model(),
    caregiverAvailability: model(),
    verificationItem: model(),
    journalEntry: model(),
    auditLog: model(),
  });
  const tx = client();
  const db = { ...client(), $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };
  return {
    tx,
    db,
    logAudit: vi.fn(),
    notifyLakou: vi.fn(),
    recordProof: vi.fn(),
    refreshVisitStatus: vi.fn(),
    isDemoMode: vi.fn(() => false),
  };
});

vi.mock("@/server/db", () => ({ db: m.db }));
vi.mock("@/server/audit", () => ({ logAudit: m.logAudit }));
vi.mock("@/server/outbox", () => ({ notifyLakou: m.notifyLakou }));
vi.mock("@/server/env", () => ({ isDemoMode: m.isDemoMode }));
vi.mock("@/server/visits/service", () => ({ recordProof: m.recordProof, refreshVisitStatus: m.refreshVisitStatus }));
vi.mock("@/server/matching/locks", () => ({ lockCareRequests: vi.fn(async () => undefined) }));
vi.mock("@/server/matching/service", () => ({
  inTransaction: async (client: unknown, fn: (t: unknown) => unknown) => (client ? fn(client) : m.db.$transaction(fn as never)),
}));

const service = await import("./service");
const { AccompagnantError, acceptProposal, declineProposal, checkInWithCode, checkInWithGps, checkOut, createKaye, saveOrientation } =
  service;

const josiane = { id: "user-josiane", role: "ACCOMPAGNANT" as const, firstName: "Josiane" };
const NOW = new Date("2026-10-05T14:00:00Z"); // lundi 10 h en Martinique

function resetAll(obj: Record<string, unknown>) {
  for (const v of Object.values(obj)) {
    if (typeof v === "function" && "mockReset" in v) (v as ReturnType<typeof vi.fn>).mockReset();
    else if (v && typeof v === "object") resetAll(v as Record<string, unknown>);
  }
}

beforeEach(() => {
  resetAll(m.tx);
  resetAll(m.db);
  m.db.$transaction.mockImplementation(async (cb: (t: typeof m.tx) => unknown) => cb(m.tx));
  m.logAudit.mockReset();
  m.notifyLakou.mockReset();
  m.recordProof.mockReset();
  m.refreshVisitStatus.mockReset();
  m.isDemoMode.mockReset().mockReturnValue(false);
  process.env.NEXT_PUBLIC_TEST_MODE = "false";
});

// ─────────────────────────────── Acceptation ───────────────────────────────

function proposalFixture(overrides: { validation?: string; status?: string; level?: number; caregiverStatus?: string; rate?: number | null } = {}) {
  return {
    id: "prop-ernest-josiane",
    requestId: "req-ernest",
    status: overrides.status ?? "EN_ATTENTE",
    caregiver: {
      id: "cg-josiane",
      status: overrides.caregiverStatus ?? "SALARIE_FAMILLE_CESU",
      validation: overrides.validation ?? "VALIDE",
      hasDiploma: false,
      hourlyRateCents: overrides.rate === undefined ? 1500 : overrides.rate,
    },
    request: {
      id: "req-ernest",
      aineId: "aine-ernest",
      level: overrides.level ?? 2,
      frequency: "DEUX_PAR_SEMAINE",
      durationMinutes: 90,
      startDate: null,
      slots: [
        { dayOfWeek: 1, slot: "APRES_MIDI" },
        { dayOfWeek: 3, slot: "APRES_MIDI" },
      ],
      aine: { id: "aine-ernest", firstName: "Ernest" },
    },
  };
}

describe("acceptProposal — transaction d'acceptation", () => {
  it("crée la mission (tarif copié), 8 visites, annule les autres propositions, demande POURVUE, audit + notification dans la transaction", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture());
    m.tx.missionProposal.updateMany
      .mockResolvedValueOnce({ count: 1 }) // ACCEPTEE
      .mockResolvedValueOnce({ count: 1 }); // autres → ANNULEE
    m.tx.careRequest.updateMany.mockResolvedValue({ count: 1 });
    m.tx.mission.create.mockResolvedValue({ id: "mission-1" });
    m.tx.visit.createMany.mockResolvedValue({ count: 8 });

    const r = await acceptProposal(josiane, "prop-ernest-josiane", NOW);

    expect(r).toEqual({ missionId: "mission-1", visitCount: 8, cancelledCount: 1 });
    expect(m.db.$transaction).toHaveBeenCalledTimes(1);
    // Contrôle de propriété dans la requête elle-même.
    expect(m.tx.missionProposal.findFirst.mock.calls[0]![0].where).toEqual({
      id: "prop-ernest-josiane",
      caregiver: { userId: "user-josiane" },
    });
    expect(m.tx.missionProposal.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "prop-ernest-josiane", status: "EN_ATTENTE" },
      data: { status: "ACCEPTEE", respondedAt: NOW },
    });
    expect(m.tx.careRequest.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "req-ernest", status: { in: ["PROPOSEE", "OUVERTE"] } },
      data: { status: "POURVUE" },
    });
    expect(m.tx.mission.create.mock.calls[0]![0].data).toEqual({
      requestId: "req-ernest",
      proposalId: "prop-ernest-josiane",
      aineId: "aine-ernest",
      caregiverId: "cg-josiane",
      hourlyRateCents: 1500,
    });
    const visits = m.tx.visit.createMany.mock.calls[0]![0].data as { missionId: string; caregiverId: string }[];
    expect(visits).toHaveLength(8);
    expect(visits.every((v) => v.missionId === "mission-1" && v.caregiverId === "cg-josiane")).toBe(true);
    expect(m.tx.missionProposal.updateMany.mock.calls[1]![0]).toEqual({
      where: { requestId: "req-ernest", id: { not: "prop-ernest-josiane" }, status: { in: ["EN_ATTENTE", "PROPOSEE_FAMILLE"] } },
      data: { status: "ANNULEE", respondedAt: NOW },
    });
    // Audit et notification passent le client de transaction.
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "proposal.accepted" }), m.tx);
    expect(m.notifyLakou).toHaveBeenCalledWith(
      "aine-ernest",
      "PROPOSITION_ACCEPTEE",
      { accompagnant: "Josiane", aine: "Ernest" },
      { type: "Mission", id: "mission-1" },
      m.tx,
    );
    // Rien n'est écrit hors transaction.
    expect(m.db.mission.create).not.toHaveBeenCalled();
    expect(m.db.visit.createMany).not.toHaveBeenCalled();
  });

  it("refuse la proposition d'un autre accompagnant (introuvable), sans aucune écriture", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(null);
    await expect(acceptProposal(josiane, "prop-autre", NOW)).rejects.toMatchObject({ code: "INTROUVABLE" });
    expect(m.tx.missionProposal.updateMany).not.toHaveBeenCalled();
    expect(m.tx.mission.create).not.toHaveBeenCalled();
  });

  it("refuse si la demande est déjà pourvue (clic simultané) : l'erreur annule la transaction", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture());
    m.tx.missionProposal.updateMany.mockResolvedValue({ count: 1 });
    m.tx.careRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toMatchObject({ code: "CONFLIT" });
    expect(m.tx.mission.create).not.toHaveBeenCalled();
    expect(m.notifyLakou).not.toHaveBeenCalled();
  });

  it("refuse une proposition déjà traitée", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture({ status: "ANNULEE" }));
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toMatchObject({ code: "CONFLIT" });
  });

  it("refuse si le profil n'est pas vérifié", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture({ validation: "SUSPENDU" }));
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toMatchObject({ code: "INTERDIT" });
    expect(m.tx.missionProposal.updateMany).not.toHaveBeenCalled();
  });

  it("RM-02 : un auto-entrepreneur ne peut pas accepter un niveau 3", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture({ caregiverStatus: "AUTO_ENTREPRENEUR_SAP", level: 3 }));
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toMatchObject({ code: "INTERDIT" });
  });

  it("D10 : refuse un salarié dont le tarif est sous le plancher (réorientation après un tarif libre)", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture({ rate: 900 }));
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toMatchObject({ code: "TARIF" });
    expect(m.tx.careRequest.updateMany).not.toHaveBeenCalled();
    expect(m.tx.mission.create).not.toHaveBeenCalled();
  });

  it("m1 : verrouille la DEMANDE avant d'écrire (même ordre que choisir, annuler, suspendre)", async () => {
    const { lockCareRequests } = await import("@/server/matching/locks");
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture());
    m.tx.careRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toMatchObject({ code: "CONFLIT" });
    expect(lockCareRequests).toHaveBeenCalledWith(m.tx, ["req-ernest"]);
    // La demande est écrite (et contrôlée) avant la proposition.
    expect(m.tx.missionProposal.updateMany).not.toHaveBeenCalled();
  });

  it("demande un tarif avant d'accepter (salarié sans tarif)", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue(proposalFixture({ rate: null }));
    await expect(acceptProposal(josiane, "prop-ernest-josiane", NOW)).rejects.toThrow(/tarif/);
  });
});

// ─────────────────────────────── Refus ───────────────────────────────

describe("declineProposal — refus sans pénalité", () => {
  it("passe la proposition en REFUSEE, rouvre la demande si plus rien n'est en attente, ne touche pas au profil", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue({
      id: "prop-1",
      requestId: "req-1",
      request: { aineId: "aine-1", aine: { id: "aine-1", firstName: "Ernest" } },
    });
    m.tx.missionProposal.updateMany.mockResolvedValue({ count: 1 });
    m.tx.missionProposal.count.mockResolvedValue(0);
    m.tx.careRequest.updateMany.mockResolvedValue({ count: 1 });

    const r = await declineProposal(josiane, "prop-1", "Je suis déjà prise le mardi.", NOW);

    expect(r).toEqual({ reopened: true });
    expect(m.tx.missionProposal.updateMany.mock.calls[0]![0].data).toEqual({
      status: "REFUSEE",
      declineNote: "Je suis déjà prise le mardi.",
      respondedAt: NOW,
    });
    expect(m.tx.careRequest.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "req-1", status: "PROPOSEE" },
      data: { status: "OUVERTE" },
    });
    // RM-05 : aucune écriture sur le profil de l'accompagnant.
    expect(m.tx.caregiverProfile.update).not.toHaveBeenCalled();
    expect(m.tx.caregiverProfile.updateMany).not.toHaveBeenCalled();
    // La note n'est ni dans l'audit ni dans la notification.
    const audit = m.logAudit.mock.calls[0]![0];
    expect(audit.metadata).toEqual({ hasNote: true, requestReopened: true });
    expect(JSON.stringify(m.notifyLakou.mock.calls)).not.toContain("prise le mardi");
  });

  it("garde la demande PROPOSEE si un autre accompagnant n'a pas encore répondu", async () => {
    m.tx.missionProposal.findFirst.mockResolvedValue({
      id: "prop-1",
      requestId: "req-1",
      request: { aineId: "aine-1", aine: { id: "aine-1", firstName: "Ernest" } },
    });
    m.tx.missionProposal.updateMany.mockResolvedValue({ count: 1 });
    m.tx.missionProposal.count.mockResolvedValue(1);
    expect(await declineProposal(josiane, "prop-1", null, NOW)).toEqual({ reopened: false });
    expect(m.tx.careRequest.updateMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── Propriété de la visite ───────────────────────────────

function visitFixture(
  over: Partial<{ checkInAt: Date | null; checkOutAt: Date | null; status: string; proofs: unknown[]; journal: unknown; validation: string; missionStatus: string }> = {},
) {
  return {
    id: "visit-1",
    aineId: "aine-leonie",
    status: over.status ?? "PREVUE",
    scheduledStart: new Date("2026-10-05T15:00:00Z"),
    scheduledEnd: new Date("2026-10-05T17:00:00Z"),
    checkInAt: over.checkInAt ?? null,
    checkOutAt: over.checkOutAt ?? null,
    aine: { id: "aine-leonie", firstName: "Léonie", latitude: 14.6173, longitude: -61.0597, homeCode: "LKW7Q3" },
    proofs: over.proofs ?? [],
    journal: over.journal ?? null,
    caregiver: { validation: over.validation ?? "VALIDE" },
    mission: { status: over.missionStatus ?? "ACTIVE" },
  };
}

describe("la visite appartient bien à cet accompagnant", () => {
  const OWNED_WHERE = { id: "visit-1", caregiver: { userId: "user-josiane" } };

  it("ownedVisitWhere filtre par l'utilisateur connecté", () => {
    expect(service.ownedVisitWhere("user-josiane", "visit-1")).toEqual(OWNED_WHERE);
  });

  it.each([
    ["check-in GPS", () => checkInWithGps(josiane, { visitId: "visit-1", latitude: 14.6, longitude: -61 }, NOW)],
    ["code domicile", () => checkInWithCode(josiane, "visit-1", "LKW7Q3", NOW)],
    ["check-out", () => checkOut(josiane, "visit-1", NOW)],
    [
      "Kayé",
      () =>
        createKaye(josiane, {
          visitId: "visit-1",
          mood: 4,
          appetite: "BON",
          activities: [],
          note: null,
          alertFlag: false,
          alertNote: null,
        }),
    ],
  ])("%s : visite d'un autre accompagnant → introuvable, aucune écriture", async (_name, run) => {
    m.db.visit.findFirst.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ code: "INTROUVABLE" });
    expect(m.db.visit.findFirst.mock.calls[0]![0].where).toEqual(OWNED_WHERE);
    expect(m.recordProof).not.toHaveBeenCalled();
    expect(m.db.visit.updateMany).not.toHaveBeenCalled();
    expect(m.tx.journalEntry.create).not.toHaveBeenCalled();
    expect(m.notifyLakou).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── Check-in ───────────────────────────────

describe("check-in", () => {
  it("code correct : pose le check-in, notifie VISITE_COMMENCEE, enregistre la preuve (sans le code)", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture());
    m.db.auditLog.count.mockResolvedValue(0);
    m.db.visit.updateMany.mockResolvedValue({ count: 1 });
    await checkInWithCode(josiane, "visit-1", " lkw 7q3 ", NOW);
    expect(m.db.visit.updateMany).toHaveBeenCalledWith({ where: { id: "visit-1", checkInAt: null }, data: { checkInAt: NOW } });
    expect(m.notifyLakou).toHaveBeenCalledWith("aine-leonie", "VISITE_COMMENCEE", expect.any(Object), { type: "Visit", id: "visit-1" });
    expect(m.recordProof).toHaveBeenCalledWith("visit-1", expect.objectContaining({ factor: "CODE_DOMICILE", valid: true }), josiane);
    expect(JSON.stringify(m.recordProof.mock.calls)).not.toContain("LKW7Q3");
    expect(JSON.stringify(m.logAudit.mock.calls)).not.toContain("LKW7Q3");
  });

  it("code faux : pas de preuve, essai journalisé ; bloqué après 5 essais", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture());
    m.db.auditLog.count.mockResolvedValue(2);
    await expect(checkInWithCode(josiane, "visit-1", "AAAAAA", NOW)).rejects.toThrow(/2 essais/);
    expect(m.recordProof).not.toHaveBeenCalled();
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "visit.code.failed" }));

    m.db.auditLog.count.mockResolvedValue(5);
    await expect(checkInWithCode(josiane, "visit-1", "LKW7Q3", NOW)).rejects.toMatchObject({ code: "INTERDIT" });
  });

  it("GPS : une position valide n'est jamais relue", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ proofs: [{ factor: "GPS", valid: true }] }));
    await expect(checkInWithGps(josiane, { visitId: "visit-1", latitude: 14.6, longitude: -61 }, NOW)).rejects.toMatchObject({
      code: "CONFLIT",
    });
    expect(m.recordProof).not.toHaveBeenCalled();
  });

  it("GPS : position au domicile → facteur valide avec la distance", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture());
    m.db.visit.updateMany.mockResolvedValue({ count: 1 });
    const r = await checkInWithGps(josiane, { visitId: "visit-1", latitude: 14.6175, longitude: -61.0598, accuracy: 20 }, NOW);
    expect(r.valid).toBe(true);
    expect(m.recordProof).toHaveBeenCalledWith(
      "visit-1",
      expect.objectContaining({ factor: "GPS", valid: true, simulated: false, accuracyMeters: 20 }),
      josiane,
    );
  });

  it("GPS simulé : interdit hors mode test", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture());
    await expect(checkInWithGps(josiane, { visitId: "visit-1", simulated: true }, NOW)).rejects.toMatchObject({ code: "INTERDIT" });
    m.isDemoMode.mockReturnValue(true);
    m.db.visit.updateMany.mockResolvedValue({ count: 1 });
    await expect(checkInWithGps(josiane, { visitId: "visit-1", simulated: true }, NOW)).resolves.toMatchObject({ valid: true });
  });

  it("refuse une preuve après le check-out", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ checkInAt: NOW, checkOutAt: NOW, status: "VALIDEE" }));
    await expect(checkInWithCode(josiane, "visit-1", "LKW7Q3", NOW)).rejects.toMatchObject({ code: "CONFLIT" });
  });

  it("check-out sans check-in → refusé", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture());
    await expect(checkOut(josiane, "visit-1", NOW)).rejects.toThrow(/check-in/);
  });
});

// ─────────────────────────────── Kayé ───────────────────────────────

describe("createKaye — un seul Kayé par visite", () => {
  const input = {
    visitId: "visit-1",
    mood: 4,
    appetite: "BON" as const,
    activities: ["Promenade"],
    note: "Promenade à la Savane.",
    alertFlag: true,
    alertNote: "Fatigue en fin de visite.",
  };

  it("crée le Kayé, journalise sans le texte, notifie KAYE_PUBLIE et ALERTE_A_SURVEILLER au cercle Lakou", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ checkInAt: NOW, status: "VALIDEE" }));
    m.tx.journalEntry.create.mockResolvedValue({ id: "journal-1" });
    await createKaye(josiane, input);
    expect(m.tx.journalEntry.create.mock.calls[0]![0].data).toMatchObject({
      visitId: "visit-1",
      aineId: "aine-leonie",
      authorId: "user-josiane",
      mood: 4,
      alertFlag: true,
    });
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "journal.created", metadata: { alertFlag: true } }),
      m.tx,
    );
    const templates = m.notifyLakou.mock.calls.map((c) => c[1]);
    expect(templates).toEqual(["KAYE_PUBLIE", "ALERTE_A_SURVEILLER"]);
    expect(m.notifyLakou.mock.calls[0]![2]).toEqual({ aine: "Léonie", accompagnant: "Josiane", humeur: "Bien" });
    // Aucune donnée du Kayé (note, précision) dans les messages.
    expect(JSON.stringify(m.notifyLakou.mock.calls)).not.toMatch(/Savane|Fatigue/);
  });

  it("pas d'alerte → seulement KAYE_PUBLIE", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ checkInAt: NOW }));
    m.tx.journalEntry.create.mockResolvedValue({ id: "journal-1" });
    await createKaye(josiane, { ...input, alertFlag: false, alertNote: null });
    expect(m.notifyLakou.mock.calls.map((c) => c[1])).toEqual(["KAYE_PUBLIE"]);
  });

  it("refuse un deuxième Kayé", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ checkInAt: NOW, journal: { id: "journal-1" } }));
    await expect(createKaye(josiane, input)).rejects.toMatchObject({ code: "CONFLIT" });
    expect(m.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it("deux envois simultanés : la contrainte unique (P2002) devient un message clair", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ checkInAt: NOW }));
    m.tx.journalEntry.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );
    const err = await createKaye(josiane, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AccompagnantError);
    expect((err as InstanceType<typeof AccompagnantError>).message).toMatch(/existe déjà/);
  });

  it("refuse le Kayé avant le check-in", async () => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture());
    await expect(createKaye(josiane, input)).rejects.toThrow(/check-in/);
  });
});

// ─────────────────────────────── Orientation ───────────────────────────────

describe("saveOrientation", () => {
  const answers = {
    activity: "PRESENCE" as const,
    paid: true,
    existingStatus: "AUCUN" as const,
    situations: [],
    familyLink: "AUCUN" as const,
  };

  it("RM-03 : niveaux recalculés côté serveur, vérifications créées", async () => {
    m.db.caregiverProfile.upsert.mockResolvedValue({
      id: "cg-1",
      validation: "BROUILLON",
      hasDiploma: false,
      hourlyRateCents: null,
      availabilities: [],
      verifications: [],
    });
    const r = await saveOrientation(josiane, answers);
    expect(r.status).toBe("SALARIE_FAMILLE_CESU");
    expect(m.tx.caregiverProfile.update.mock.calls[0]![0].data).toMatchObject({
      status: "SALARIE_FAMILLE_CESU",
      allowedLevels: [1, 2, 3],
      validation: "BROUILLON",
    });
    const types = m.tx.verificationItem.upsert.mock.calls.map((c) => c[0].create.type);
    expect(types).toEqual(r.requiredVerifications);
    expect(types).toContain("PSC1");
  });

  it("interdit de refaire l'orientation d'un profil vérifié", async () => {
    m.db.caregiverProfile.upsert.mockResolvedValue({ id: "cg-1", validation: "VALIDE", hasDiploma: false });
    await expect(saveOrientation(josiane, answers)).rejects.toMatchObject({ code: "INTERDIT" });
    expect(m.db.$transaction).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── A1 : accompagnant suspendu ───────────────────────────────

describe("A1 : un accompagnant suspendu ou une mission suspendue n'a plus de check-in ni de Kayé", () => {
  const kaye = { visitId: "visit-1", mood: 4, appetite: "BON" as const, activities: [], note: null, alertFlag: false, alertNote: null };

  it.each([
    ["profil suspendu", { validation: "SUSPENDU" }],
    ["profil refusé", { validation: "REFUSE" }],
    ["mission suspendue", { missionStatus: "SUSPENDUE" }],
  ])("%s : check-in GPS, code et Kayé refusés, aucune écriture", async (_n, over) => {
    m.db.visit.findFirst.mockResolvedValue(visitFixture({ ...over, checkInAt: NOW }));
    await expect(checkInWithGps(josiane, { visitId: "visit-1", simulated: true }, NOW)).rejects.toMatchObject({ code: "INTERDIT" });
    await expect(checkInWithCode(josiane, "visit-1", "LKW7Q3", NOW)).rejects.toMatchObject({ code: "INTERDIT" });
    await expect(createKaye(josiane, kaye)).rejects.toMatchObject({ code: "INTERDIT" });
    expect(m.recordProof).not.toHaveBeenCalled();
    expect(m.db.visit.updateMany).not.toHaveBeenCalled();
    expect(m.tx.journalEntry.create).not.toHaveBeenCalled();
    expect(m.notifyLakou).not.toHaveBeenCalled();
  });
});

describe("D10 : réorientation vers un statut salarié", () => {
  const salarie = { activity: "PRESENCE" as const, paid: true, existingStatus: "AUCUN" as const, situations: [], familyLink: "AUCUN" as const };

  it("efface un tarif sous le plancher : le profil redevient incomplet", async () => {
    m.db.caregiverProfile.upsert.mockResolvedValue({ id: "cg-1", validation: "BROUILLON", hasDiploma: false, hourlyRateCents: 900, availabilities: [], verifications: [] });
    const r = await saveOrientation(josiane, salarie);
    expect(r.status).toBe("SALARIE_FAMILLE_CESU");
    expect(m.tx.caregiverProfile.update.mock.calls[0]![0].data.hourlyRateCents).toBeNull();
  });

  it("garde un tarif au-dessus du plancher", async () => {
    m.db.caregiverProfile.upsert.mockResolvedValue({ id: "cg-1", validation: "BROUILLON", hasDiploma: false, hourlyRateCents: 1500, availabilities: [], verifications: [] });
    await saveOrientation(josiane, salarie);
    expect(m.tx.caregiverProfile.update.mock.calls[0]![0].data.hourlyRateCents).toBe(1500);
  });
});
