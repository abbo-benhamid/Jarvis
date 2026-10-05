import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────── Mocks : aucun accès réel à la base (les données de démo restent intactes) ───────────

const user = { id: "cmuser000000000000000001", email: "f@x.test", role: "FAMILLE" as const, firstName: "Sandrine", lastName: "J", isDemo: true, sandboxId: null };
const requireRole = vi.fn(async () => user);
const canAccessAine = vi.fn(async () => true);
const logAudit = vi.fn(async () => undefined);
const enqueueNotification = vi.fn(async () => ({}));
const notifyUser = vi.fn(async () => ({}));
const confirmElderSimulated = vi.fn(async () => ({ status: "VALIDEE" }));
const generateUniqueHomeCode = vi.fn(async () => "ABC234");
const revalidatePath = vi.fn();
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

function model() {
  return {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  };
}
const db = {
  aine: model(),
  lakouMember: model(),
  invitation: model(),
  careRequest: model(),
  missionProposal: model(),
  visit: model(),
  subscription: model(),
  simulatedPayment: model(),
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
};

vi.mock("@/server/auth/guards", () => ({ requireRole: () => requireRole() }));
vi.mock("@/server/access", () => ({ canAccessAine: (...a: unknown[]) => canAccessAine(...(a as [])) }));
vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...(a as [])) }));
vi.mock("@/server/outbox", () => ({
  enqueueNotification: (...a: unknown[]) => enqueueNotification(...(a as [])),
  notifyUser: (...a: unknown[]) => notifyUser(...(a as [])),
}));
vi.mock("@/server/visits/service", () => ({
  confirmElderSimulated: (...a: unknown[]) => confirmElderSimulated(...(a as [])),
  generateUniqueHomeCode: () => generateUniqueHomeCode(),
}));
vi.mock("@/server/env", () => ({ appUrl: () => "https://koudmen.test" }));
const cancelCareRequest = vi.fn(async (..._a: unknown[]) => ({ cancelledProposals: 2 }));
const chooseProfile = vi.fn(async (..._a: unknown[]) => ({ caregiverFirstName: "Josiane" }));
class MatchingError extends Error {}
vi.mock("@/server/matching/service", () => ({
  cancelCareRequest: (...a: unknown[]) => cancelCareRequest(...a),
  chooseProfile: (...a: unknown[]) => chooseProfile(...a),
  MatchingError,
}));
const trackEvent = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/server/sandbox/events", () => ({ trackEvent: (...a: unknown[]) => trackEvent(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const actions = await import("./actions");
const empty = { ok: false as const, error: "" };

const AINE = "cmaine00000000000000000001";
const OTHER = "cmaine00000000000000000002";

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  canAccessAine.mockResolvedValue(true);
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
});

// ─────────── F2 ───────────

describe("createAineAction", () => {
  const valid = {
    firstName: "Léonie",
    lastInitial: "J",
    myRelation: "fille",
    commune: "FORT_DE_FRANCE",
    needs: ["COMPAGNIE"],
    activityLevel: "3",
    consentGiven: "on",
    consentByType: "AINE",
    consentByName: "Léonie Joseph",
  };

  it("refuse sans consentement et n'écrit rien", async () => {
    const { consentGiven: _c, ...rest } = valid;
    const r = await actions.createAineAction(empty, fd(rest));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fieldErrors?.consentGiven).toBeTruthy();
    expect(db.aine.create).not.toHaveBeenCalled();
  });

  it("crée l'aîné au centre de la commune, le cercle (payeur), la formule Lakou et journalise", async () => {
    db.aine.create.mockResolvedValue({ id: AINE });
    await expect(actions.createAineAction(empty, fd(valid))).rejects.toThrow(`REDIRECT:/famille/aines/${AINE}?cree=1`);
    const data = db.aine.create.mock.calls[0]![0].data;
    expect(data.latitude).toBeCloseTo(14.6161);
    expect(data.longitude).toBeCloseTo(-61.0588);
    expect(data.homeCode).toBe("ABC234");
    expect(data.consentGiven).toBe(true);
    expect(data.ownerId).toBe(user.id);
    expect(data.members.create).toEqual({ userId: user.id, relation: "fille", isPayer: true });
    expect(data.subscription.create).toEqual({ payerId: user.id, plan: "LAKOU", priceCents: 0 });
    const auditActions = logAudit.mock.calls.map((c) => (c as unknown as [{ action: string }])[0].action);
    expect(auditActions).toEqual(["aine.created", "aine.consent"]);
  });
});

describe("updateAineAction", () => {
  it("refuse un membre qui n'est pas le payeur", async () => {
    db.lakouMember.findUnique.mockResolvedValue({ isPayer: false });
    const r = await actions.updateAineAction(
      empty,
      fd({ aineId: AINE, firstName: "L", commune: "FORT_DE_FRANCE", needs: ["COMPAGNIE"], activityLevel: "1", consentGiven: "on", consentByType: "AINE", consentByName: "Léonie" }),
    );
    expect(r).toEqual({ ok: false, error: "Seul le gestionnaire principal du profil peut le modifier." });
    expect(db.aine.update).not.toHaveBeenCalled();
  });
});

// ─────────── F4 / F10 ───────────

describe("inviteLakouAction", () => {
  it("refuse un aîné hors du cercle (IDOR)", async () => {
    canAccessAine.mockResolvedValue(false);
    const r = await actions.inviteLakouAction({ ok: false, error: "" }, fd({ aineId: OTHER, relation: "fils" }));
    expect(r.ok).toBe(false);
    expect(db.invitation.create).not.toHaveBeenCalled();
  });

  it("crée un lien aléatoire de 14 jours, notifie l'email et n'écrit ni jeton ni email dans l'audit", async () => {
    db.aine.findUniqueOrThrow.mockResolvedValue({ firstName: "Léonie" });
    db.invitation.create.mockResolvedValue({ id: "inv1" });
    const before = Date.now();
    const r = await actions.inviteLakouAction({ ok: false, error: "" }, fd({ aineId: AINE, relation: "fils", email: "frere@demo.test" }));
    expect(r.ok).toBe(true);
    const data = db.invitation.create.mock.calls[0]![0].data;
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const ttl = data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(14 * 86_400_000 - 1000);
    expect(ttl).toBeLessThanOrEqual(14 * 86_400_000 + 1000);
    expect(r.ok && r.data?.link).toBe(`https://koudmen.test/invitation/${data.token}`);
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "EMAIL", to: "frere@demo.test", template: "INVITATION_LAKOU" }),
      db,
    );
    const audit = (logAudit.mock.calls[0] as unknown as [{ action: string; metadata: unknown }])[0];
    expect(audit.action).toBe("lakou.invited");
    expect(JSON.stringify(audit.metadata)).not.toContain(data.token);
    expect(JSON.stringify(audit.metadata)).not.toContain("frere@");
  });

  it("ne notifie personne sans email", async () => {
    db.aine.findUniqueOrThrow.mockResolvedValue({ firstName: "Léonie" });
    db.invitation.create.mockResolvedValue({ id: "inv1" });
    await actions.inviteLakouAction({ ok: false, error: "" }, fd({ aineId: AINE, relation: "fils", email: "" }));
    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});

describe("joinCircleAction", () => {
  const token = "demo-invitation-lakou-leonie";
  const future = () => new Date(Date.now() + 86_400_000);

  it("refuse un lien expiré", async () => {
    db.invitation.findUnique.mockResolvedValue({ id: "i", kind: "LAKOU", aineId: AINE, relation: "nièce", expiresAt: new Date(Date.now() - 1000), acceptedAt: null, aine: { sandboxId: null } });
    const r = await actions.joinCircleAction(empty, fd({ token }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("expiré");
    expect(db.lakouMember.create).not.toHaveBeenCalled();
  });

  it("refuse un lien déjà utilisé", async () => {
    db.invitation.findUnique.mockResolvedValue({ id: "i", kind: "LAKOU", aineId: AINE, relation: "nièce", expiresAt: future(), acceptedAt: new Date(), aine: { sandboxId: null } });
    const r = await actions.joinCircleAction(empty, fd({ token }));
    expect(!r.ok && r.error).toContain("déjà été utilisé");
  });

  it("refuse si un autre compte a utilisé le lien entre-temps (course)", async () => {
    db.invitation.findUnique.mockResolvedValue({ id: "i", kind: "LAKOU", aineId: AINE, relation: "nièce", expiresAt: future(), acceptedAt: null, aine: { sandboxId: null } });
    db.lakouMember.findUnique.mockResolvedValue(null);
    db.invitation.updateMany.mockResolvedValue({ count: 0 });
    const r = await actions.joinCircleAction(empty, fd({ token }));
    expect(r.ok).toBe(false);
    expect(db.lakouMember.create).not.toHaveBeenCalled();
  });

  it("ajoute le membre au cercle, journalise et redirige", async () => {
    db.invitation.findUnique.mockResolvedValue({ id: "i", kind: "LAKOU", aineId: AINE, relation: "nièce", expiresAt: future(), acceptedAt: null, aine: { sandboxId: null } });
    db.lakouMember.findUnique.mockResolvedValue(null);
    db.invitation.updateMany.mockResolvedValue({ count: 1 });
    await expect(actions.joinCircleAction(empty, fd({ token }))).rejects.toThrow(`REDIRECT:/famille/aines/${AINE}?bienvenue=1`);
    expect(db.lakouMember.create).toHaveBeenCalledWith({ data: { aineId: AINE, userId: user.id, relation: "nièce", isPayer: false } });
    expect((logAudit.mock.calls[0] as unknown as [{ action: string }])[0].action).toBe("lakou.joined");
  });

  it("D2 : refuse un lien qui vient d'un autre monde (bac à sable)", async () => {
    db.invitation.findUnique.mockResolvedValue({ id: "i", kind: "LAKOU", aineId: AINE, relation: "nièce", expiresAt: future(), acceptedAt: null, aine: { sandboxId: "sbx-autre" } });
    const r = await actions.joinCircleAction(empty, fd({ token }));
    expect(!r.ok && r.error).toContain("pas valide");
    expect(db.lakouMember.create).not.toHaveBeenCalled();
  });

  it("A6 : un lien « proche aidant » n'ouvre jamais le cercle Lakou", async () => {
    db.invitation.findUnique.mockResolvedValue({ id: "i", kind: "PROCHE_AIDANT", aineId: AINE, relation: "proche aidant", expiresAt: future(), acceptedAt: null, aine: { sandboxId: null } });
    const r = await actions.joinCircleAction(empty, fd({ token }));
    expect(!r.ok && r.error).toContain("pas valide");
    expect(db.lakouMember.create).not.toHaveBeenCalled();
  });

  it("A6 : seul le payeur crée un lien proche aidant ; le jeton n'est pas dans l'audit", async () => {
    db.lakouMember.findUnique.mockResolvedValue({ isPayer: false });
    const refused = await actions.inviteCaregiverRelativeAction(empty, fd({ aineId: AINE }));
    expect(!refused.ok && refused.error).toMatch(/gestionnaire principal/);
    db.lakouMember.findUnique.mockResolvedValue({ isPayer: true });
    db.invitation.create.mockResolvedValue({ id: "inv-pa" });
    const r = await actions.inviteCaregiverRelativeAction(empty, fd({ aineId: AINE }));
    expect(r.ok && r.data?.link).toMatch(/^https:\/\/koudmen\.test\/proche-aidant\/[A-Za-z0-9_-]{32}$/);
    expect(db.invitation.create.mock.calls[0]![0].data).toMatchObject({ kind: "PROCHE_AIDANT", aineId: AINE });
    const linkToken = (r.ok && r.data?.link.split("/").pop()) || "";
    expect(JSON.stringify(logAudit.mock.calls)).not.toContain(linkToken);
  });

  it("refuse un jeton mal formé sans requête", async () => {
    const r = await actions.joinCircleAction(empty, fd({ token: "x" }));
    expect(r.ok).toBe(false);
    expect(db.invitation.findUnique).not.toHaveBeenCalled();
  });
});

// ─────────── F5 / F6 ───────────

describe("createRequestAction", () => {
  const valid = { aineId: AINE, level: "3", frequency: "HEBDOMADAIRE", slots: ["0-MATIN", "0-MATIN", "5-APRES_MIDI"], durationMinutes: "120" };

  it("refuse un aîné hors du cercle", async () => {
    canAccessAine.mockResolvedValue(false);
    const r = await actions.createRequestAction(empty, fd(valid));
    expect(r.ok).toBe(false);
    expect(db.careRequest.create).not.toHaveBeenCalled();
  });

  it("crée la demande OUVERTE avec des créneaux uniques", async () => {
    db.careRequest.create.mockResolvedValue({ id: "r1" });
    await expect(actions.createRequestAction(empty, fd(valid))).rejects.toThrow("REDIRECT:/famille/demandes?envoyee=1");
    const data = db.careRequest.create.mock.calls[0]![0].data;
    expect(data.status).toBe("OUVERTE");
    expect(data.slots.create).toEqual([
      { dayOfWeek: 0, slot: "MATIN" },
      { dayOfWeek: 5, slot: "APRES_MIDI" },
    ]);
    expect((logAudit.mock.calls[0] as unknown as [{ action: string }])[0].action).toBe("request.created");
  });
});

describe("cancelRequestAction", () => {
  it("refuse la demande d'une autre famille (IDOR)", async () => {
    db.careRequest.findUnique.mockResolvedValue({ id: "cmreq0000000000000000001", aineId: OTHER, status: "OUVERTE" });
    canAccessAine.mockResolvedValue(false);
    const r = await actions.cancelRequestAction(empty, fd({ requestId: "cmreq0000000000000000001" }));
    expect(r.ok).toBe(false);
    expect(db.careRequest.update).not.toHaveBeenCalled();
  });

  it("refuse une demande déjà pourvue", async () => {
    db.careRequest.findUnique.mockResolvedValue({ id: "cmreq0000000000000000001", aineId: AINE, status: "POURVUE" });
    const r = await actions.cancelRequestAction(empty, fd({ requestId: "cmreq0000000000000000001" }));
    expect(r).toEqual({ ok: false, error: "Cette demande ne peut plus être annulée." });
  });

  it("annule la demande et les propositions en attente", async () => {
    db.careRequest.findUnique.mockResolvedValue({ id: "cmreq0000000000000000001", aineId: AINE, status: "PROPOSEE" });
    await expect(actions.cancelRequestAction(empty, fd({ requestId: "cmreq0000000000000000001" }))).rejects.toThrow(
      "REDIRECT:/famille/demandes?annulee=1",
    );
    // M5 : toute l'annulation passe par la transaction du service (verrou, statut relu, propositions, message).
    expect(cancelCareRequest).toHaveBeenCalledWith(user, "cmreq0000000000000000001");
    expect(db.careRequest.update).not.toHaveBeenCalled();
  });

  it("M5 : une acceptation simultanée gagne → message clair, pas de redirection", async () => {
    db.careRequest.findUnique.mockResolvedValue({ id: "cmreq0000000000000000001", aineId: AINE, status: "PROPOSEE" });
    cancelCareRequest.mockRejectedValueOnce(new MatchingError("Cette demande ne peut plus être annulée."));
    const r = await actions.cancelRequestAction(empty, fd({ requestId: "cmreq0000000000000000001" }));
    expect(r).toEqual({ ok: false, error: "Cette demande ne peut plus être annulée." });
  });
});

describe("chooseProfileAction", () => {
  const PROP = "cmprop000000000000000001";
  it("m7 : émet profile.chosen dans un bac à sable seulement", async () => {
    db.missionProposal.findUnique.mockResolvedValue({ id: PROP, request: { aineId: AINE } });
    requireRole.mockResolvedValueOnce({ ...user, sandboxId: "sbx1" } as never);
    await expect(actions.chooseProfileAction(empty, fd({ proposalId: PROP }))).rejects.toThrow("REDIRECT:/famille/demandes?choisi=Josiane");
    expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ sandboxId: "sbx1" }), "profile.chosen");
    trackEvent.mockClear();
    await expect(actions.chooseProfileAction(empty, fd({ proposalId: PROP }))).rejects.toThrow("REDIRECT:");
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

// ─────────── F7 ───────────

describe("confirmVisitAction", () => {
  const VISIT = "cmvisit000000000000000001";
  const past = () => new Date(Date.now() - 5 * 3_600_000);

  it("vérifie l'accès AVANT d'appeler confirmElderSimulated", async () => {
    db.visit.findUnique.mockResolvedValue({ id: VISIT, aineId: OTHER, status: "A_VERIFIER", checkInAt: null, checkOutAt: past(), scheduledEnd: past(), proofs: [] });
    canAccessAine.mockResolvedValue(false);
    const r = await actions.confirmVisitAction(empty, fd({ visitId: VISIT }));
    expect(r.ok).toBe(false);
    expect(confirmElderSimulated).not.toHaveBeenCalled();
  });

  it("refuse une visite future (PREVUE)", async () => {
    const future = new Date(Date.now() + 86_400_000);
    db.visit.findUnique.mockResolvedValue({ id: VISIT, aineId: AINE, status: "PREVUE", checkInAt: null, checkOutAt: null, scheduledEnd: future, proofs: [] });
    const r = await actions.confirmVisitAction(empty, fd({ visitId: VISIT }));
    expect(r.ok).toBe(false);
    expect(confirmElderSimulated).not.toHaveBeenCalled();
  });

  it("confirme une visite À vérifier", async () => {
    db.visit.findUnique.mockResolvedValue({
      id: VISIT,
      aineId: AINE,
      status: "A_VERIFIER",
      checkInAt: past(),
      checkOutAt: past(),
      scheduledEnd: past(),
      proofs: [{ factor: "GPS", valid: true }],
    });
    await expect(actions.confirmVisitAction(empty, fd({ visitId: VISIT }))).rejects.toThrow("REDIRECT:/famille/visites?confirmee=validee");
    expect(confirmElderSimulated).toHaveBeenCalledWith(VISIT, user);
  });
});

// ─────────── F9 ───────────

describe("changePlanAction", () => {
  it("refuse un membre non payeur (RM-14)", async () => {
    db.lakouMember.findUnique.mockResolvedValue({ isPayer: false });
    const r = await actions.changePlanAction(empty, fd({ aineId: AINE, plan: "KOZE" }));
    expect(r).toEqual({ ok: false, error: "Seul le payeur peut changer la formule." });
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it("refuse un aîné hors du cercle", async () => {
    db.lakouMember.findUnique.mockResolvedValue(null);
    const r = await actions.changePlanAction(empty, fd({ aineId: OTHER, plan: "KOZE" }));
    expect(r.ok).toBe(false);
  });

  it("active la formule avec un paiement SIMULÉ, une notification et un audit", async () => {
    db.lakouMember.findUnique.mockResolvedValue({ isPayer: true });
    db.aine.findUniqueOrThrow.mockResolvedValue({ firstName: "Léonie", subscription: { plan: "LAKOU" } });
    db.subscription.upsert.mockResolvedValue({ id: "sub1" });
    const r = await actions.changePlanAction(empty, fd({ aineId: AINE, plan: "KOZE" }));
    expect(r.ok).toBe(true);
    expect(db.simulatedPayment.create).toHaveBeenCalledWith({ data: { subscriptionId: "sub1", amountCents: 3900, status: "SIMULE_REUSSI" } });
    expect(notifyUser).toHaveBeenCalledWith(user.id, "PAIEMENT_SIMULE", expect.objectContaining({ formule: "Kozé", aine: "Léonie" }), { type: "Subscription", id: "sub1" }, db);
    const audit = (logAudit.mock.calls[0] as unknown as [{ action: string; metadata: { from: string; to: string } }])[0];
    expect(audit.action).toBe("plan.changed");
    expect(audit.metadata).toMatchObject({ from: "LAKOU", to: "KOZE" });
  });

  it("ne crée pas de paiement si la formule est déjà active", async () => {
    db.lakouMember.findUnique.mockResolvedValue({ isPayer: true });
    db.aine.findUniqueOrThrow.mockResolvedValue({ firstName: "Léonie", subscription: { plan: "KOZE" } });
    const r = await actions.changePlanAction(empty, fd({ aineId: AINE, plan: "KOZE" }));
    expect(r.ok).toBe(true);
    expect(db.simulatedPayment.create).not.toHaveBeenCalled();
  });
});
