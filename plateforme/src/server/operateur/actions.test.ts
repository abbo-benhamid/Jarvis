import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests des Server Actions opérateur avec une base simulée.
 * Point clé : le SERVEUR refuse une proposition incompatible, même si le formulaire est modifié.
 */

const operator = { id: "op1", email: "o@x.test", role: "OPERATEUR" as const, firstName: "Équipe", lastName: "Koudmen", isDemo: false, sandboxId: null };
const requireRole = vi.fn(async (..._roles: string[]) => operator);
const logAudit = vi.fn(async (..._a: unknown[]) => undefined);
const notifyUser = vi.fn(async (..._a: unknown[]) => null);
const confirmElderSimulated = vi.fn();

const tx = {
  careRequest: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  caregiverProfile: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  missionProposal: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  verificationItem: { update: vi.fn() },
  feedback: { update: vi.fn() },
};
const db = {
  ...tx,
  caregiverProfile: { ...tx.caregiverProfile },
  verificationItem: { ...tx.verificationItem, findUnique: vi.fn() },
  visit: { findUnique: vi.fn() },
  feedback: { ...tx.feedback, findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};

vi.mock("@/server/auth/guards", () => ({ requireRole: (...r: string[]) => requireRole(...r) }));
vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/server/outbox", () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
vi.mock("@/server/visits/service", () => ({ confirmElderSimulated: (...a: unknown[]) => confirmElderSimulated(...a) }));
vi.mock("@/server/access", () => ({ assertAineAccess: async () => undefined }));
const proposeProfile = vi.fn();
class MatchingError extends Error {}
vi.mock("@/server/matching/service", () => ({ proposeProfile: (...a: unknown[]) => proposeProfile(...a), MatchingError }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { proposeCaregiverAction, decideCaregiverAction, confirmElderAction, setFeedbackStatusAction } = await import("./actions");
const { initialActionState } = await import("@/lib/action-result");

const REQ = "ckreq0000000000000000001";
const CG = "ckcg00000000000000000001";

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}


beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
});

describe("proposeCaregiverAction", () => {
  it("vérifie le rôle OPERATEUR en premier", async () => {
    requireRole.mockRejectedValueOnce(new Error("REDIRECT:/famille"));
    await expect(proposeCaregiverAction(initialActionState, form({ requestId: REQ, caregiverId: CG }))).rejects.toThrow("REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("OPERATEUR");
    expect(proposeProfile).not.toHaveBeenCalled();
  });

  it("propose le profil à la famille, dans le monde réel seulement", async () => {
    proposeProfile.mockResolvedValue({ proposalId: "p1", caregiverName: "Kévin M.", activeCount: 1 });
    const res = await proposeCaregiverAction(initialActionState, form({ requestId: REQ, caregiverId: CG, message: "Bonjour" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.message).toMatch(/proposé à la famille/);
    expect(proposeProfile).toHaveBeenCalledWith(operator, { requestId: REQ, caregiverId: CG, message: "Bonjour" }, null);
  });

  it("journalise une proposition bloquée par le serveur", async () => {
    proposeProfile.mockRejectedValue(new MatchingError("Proposition refusée : accompagnant incompatible (Niveau non autorisé pour ce statut)."));
    const res = await proposeCaregiverAction(initialActionState, form({ requestId: REQ, caregiverId: CG }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Niveau non autorisé/);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "proposal.blocked", entityId: REQ }));
  });

  it("refuse un identifiant invalide sans appeler le service", async () => {
    const res = await proposeCaregiverAction(initialActionState, form({ requestId: "x", caregiverId: CG }));
    expect(res.ok).toBe(false);
    expect(proposeProfile).not.toHaveBeenCalled();
  });
});

describe("decideCaregiverAction", () => {
  const pending = {
    id: CG,
    status: "SALARIE_FAMILLE_CESU",
    validation: "EN_ATTENTE",
    communes: ["ROBERT"],
    verifications: [
      { type: "IDENTITE", status: "VALIDE" },
      { type: "DIPLOME", status: "VALIDE" },
    ],
    user: { id: "u-cg", firstName: "Steeve" },
  };

  it("refuse un refus sans motif (aucune écriture)", async () => {
    const res = await decideCaregiverAction(initialActionState, form({ caregiverId: CG, decision: "REFUSER", reason: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.reason).toBeDefined();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("bloque la validation si une vérification obligatoire n'est pas validée", async () => {
    db.caregiverProfile.findUnique = vi.fn().mockResolvedValue({
      ...pending,
      verifications: [{ type: "CASIER_B3", status: "DECLARE" }],
    });
    const res = await decideCaregiverAction(initialActionState, form({ caregiverId: CG, decision: "VALIDER" }));
    expect(res.ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une décision impossible depuis l'état actuel", async () => {
    db.caregiverProfile.findUnique = vi.fn().mockResolvedValue({ ...pending, validation: "VALIDE" });
    const res = await decideCaregiverAction(initialActionState, form({ caregiverId: CG, decision: "VALIDER" }));
    expect(res.ok).toBe(false);
  });

  it("valide : niveaux recalculés côté serveur (diplôme validé → niveau 4), notification, audit", async () => {
    db.caregiverProfile.findUnique = vi.fn().mockResolvedValue(pending);
    tx.caregiverProfile.updateMany.mockResolvedValue({ count: 1 });
    const res = await decideCaregiverAction(initialActionState, form({ caregiverId: CG, decision: "VALIDER" }));
    expect(res.ok).toBe(true);
    expect(tx.caregiverProfile.updateMany).toHaveBeenCalledWith({
      where: { id: CG, validation: "EN_ATTENTE" },
      data: expect.objectContaining({ validation: "VALIDE", hasDiploma: true, allowedLevels: [1, 2, 3, 4], validationReason: null }),
    });
    expect(notifyUser).toHaveBeenCalledWith("u-cg", "ACCOMPAGNANT_VALIDE", { prenom: "Steeve" }, expect.anything(), tx);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "caregiver.validate" }), tx);
  });

  it("suspend avec motif : annule les propositions en attente et rouvre la demande", async () => {
    db.caregiverProfile.findUnique = vi.fn().mockResolvedValue({ ...pending, validation: "VALIDE" });
    tx.caregiverProfile.updateMany.mockResolvedValue({ count: 1 });
    tx.missionProposal.findMany.mockResolvedValue([{ id: "p1", requestId: REQ }]);
    tx.missionProposal.count.mockResolvedValue(0);
    const res = await decideCaregiverAction(
      initialActionState,
      form({ caregiverId: CG, decision: "SUSPENDRE", reason: "Plainte d'une famille, vérification en cours." }),
    );
    expect(res.ok).toBe(true);
    expect(tx.missionProposal.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["p1"] } }, data: expect.objectContaining({ status: "ANNULEE" }) });
    expect(tx.careRequest.updateMany).toHaveBeenCalledWith({ where: { id: REQ, status: "PROPOSEE" }, data: { status: "OUVERTE" } });
    expect(notifyUser).toHaveBeenCalledWith("u-cg", "ACCOMPAGNANT_SUSPENDU", expect.objectContaining({ motif: expect.stringMatching(/Plainte/) }), expect.anything(), tx);
  });

  it("D2 : refuse d'agir sur un accompagnant d'un bac à sable", async () => {
    db.caregiverProfile.findUnique = vi.fn().mockResolvedValue({ ...pending, user: { ...pending.user, sandboxId: "sbx1" } });
    const res = await decideCaregiverAction(initialActionState, form({ caregiverId: CG, decision: "VALIDER" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Accompagnant introuvable.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("signale un conflit si un autre opérateur a déjà décidé", async () => {
    db.caregiverProfile.findUnique = vi.fn().mockResolvedValue(pending);
    tx.caregiverProfile.updateMany.mockResolvedValue({ count: 0 });
    const res = await decideCaregiverAction(initialActionState, form({ caregiverId: CG, decision: "VALIDER" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/changé entre-temps/);
  });
});

describe("confirmElderAction", () => {
  const VISIT = "ckvisit00000000000000001";
  it("refuse une visite prévue (pas encore commencée)", async () => {
    db.visit.findUnique.mockResolvedValue({ id: VISIT, aineId: "a1", status: "PREVUE", proofs: [] });
    const res = await confirmElderAction(initialActionState, form({ visitId: VISIT }));
    expect(res.ok).toBe(false);
    expect(confirmElderSimulated).not.toHaveBeenCalled();
  });
  it("confirme une visite à vérifier puis affiche le résultat en haut de la liste", async () => {
    db.visit.findUnique.mockResolvedValue({ id: VISIT, aineId: "a1", status: "A_VERIFIER", proofs: [{ factor: "CODE_DOMICILE", valid: true }] });
    confirmElderSimulated.mockResolvedValue({ status: "VALIDEE", proofScore: 2 });
    await expect(confirmElderAction(initialActionState, form({ visitId: VISIT }))).rejects.toThrow(`REDIRECT:/operateur/visites?confirme=${VISIT}`);
    expect(confirmElderSimulated).toHaveBeenCalledWith(VISIT, operator);
  });
  it("refuse une deuxième confirmation", async () => {
    db.visit.findUnique.mockResolvedValue({ id: VISIT, aineId: "a1", status: "EN_COURS", proofs: [{ factor: "CONFIRMATION_AINE", valid: true }] });
    const res = await confirmElderAction(initialActionState, form({ visitId: VISIT }));
    expect(res.ok).toBe(false);
    expect(confirmElderSimulated).not.toHaveBeenCalled();
  });
});

describe("setFeedbackStatusAction", () => {
  const FB = "ckfeedback00000000000001";
  it("passe un retour de NOUVEAU à LU et audite", async () => {
    db.feedback.findUnique.mockResolvedValue({ id: FB, status: "NOUVEAU" });
    const res = await setFeedbackStatusAction(initialActionState, form({ feedbackId: FB, status: "LU" }));
    expect(res.ok).toBe(true);
    expect(tx.feedback.update).toHaveBeenCalledWith({ where: { id: FB }, data: { status: "LU" } });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "feedback.status", metadata: { from: "NOUVEAU", to: "LU" } }), tx);
  });
  it("refuse un statut inconnu", async () => {
    const res = await setFeedbackStatusAction(initialActionState, form({ feedbackId: FB, status: "SUPPRIME" }));
    expect(res.ok).toBe(false);
  });
});
