import "server-only";
import type { CaregiverStatus, CaregiverValidation, Channel, FeedbackStatus, Prisma, VisitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { checkCompatibility } from "@/server/rules/matching";
import { sweepOverdueVisits } from "@/server/visits/service";
import { REAL_WORLD } from "@/server/scope";
import { sortCandidates, STALE_REQUEST_DAYS } from "./rules";

/**
 * Lectures de l'espace opérateur. Chaque page appelle requireRole("OPERATEUR") AVANT ces fonctions.
 * On ne lit que les champs utiles (minimisation).
 *
 * CLOISONNEMENT (D2) : l'opérateur réel voit SEULEMENT le monde réel (sandboxId = null).
 * Les bacs à sable des testeurs ont leur propre opérateur « robot ». Chaque requête porte un filtre :
 * - accompagnant : `user: REAL_USER` ; demande, visite, Kayé : `aine: REAL_AINE` ; boîte d'envoi : `sandboxId: null`.
 * Exceptions voulues : les retours testeurs et la mesure du test (D15) regroupent tous les bacs à sable.
 */
const REAL_USER = { sandboxId: REAL_WORLD };
const REAL_AINE = { sandboxId: REAL_WORLD };
const REAL_ACTOR: Prisma.AuditLogWhereInput = { OR: [{ actorId: null }, { actor: { is: { sandboxId: REAL_WORLD } } }] };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fenêtre des Kayé « à surveiller » montrés au tableau de bord. */
export const ALERT_WINDOW_DAYS = 14;

// ─────────────── O1 Tableau de bord ───────────────

export async function getDashboard(now: Date = new Date()) {
  await sweepOverdueVisits({ aine: REAL_AINE }, now);
  const alertSince = new Date(now.getTime() - ALERT_WINDOW_DAYS * DAY_MS);
  const staleBefore = new Date(now.getTime() - STALE_REQUEST_DAYS * DAY_MS);
  const [
    caregiversPending,
    requestsOpen,
    requestsOpenStale,
    requestsProposed,
    visitsToCheck,
    alerts,
    feedbackNew,
    outboxToday,
    pendingCaregivers,
    openRequests,
    visitsList,
    alertList,
    feedbackList,
  ] = await Promise.all([
    db.caregiverProfile.count({ where: { validation: "EN_ATTENTE", user: REAL_USER } }),
    db.careRequest.count({ where: { status: "OUVERTE", aine: REAL_AINE } }),
    db.careRequest.count({ where: { status: "OUVERTE", createdAt: { lt: staleBefore }, aine: REAL_AINE } }),
    db.careRequest.count({ where: { status: "PROPOSEE", aine: REAL_AINE } }),
    db.visit.count({ where: { status: "A_VERIFIER", aine: REAL_AINE } }),
    db.journalEntry.count({ where: { alertFlag: true, createdAt: { gte: alertSince }, aine: REAL_AINE } }),
    db.feedback.count({ where: { status: "NOUVEAU" } }),
    db.outboxMessage.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) }, sandboxId: REAL_WORLD } }),
    db.caregiverProfile.findMany({
      where: { validation: "EN_ATTENTE", user: REAL_USER },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: { id: true, status: true, updatedAt: true, user: { select: { firstName: true, lastName: true } } },
    }),
    db.careRequest.findMany({
      where: { status: "OUVERTE", aine: REAL_AINE },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, level: true, createdAt: true, aine: { select: { firstName: true, commune: true } } },
    }),
    db.visit.findMany({
      where: { status: "A_VERIFIER", aine: REAL_AINE },
      orderBy: { scheduledStart: "desc" },
      take: 5,
      select: {
        id: true,
        scheduledStart: true,
        proofScore: true,
        aine: { select: { firstName: true } },
        caregiver: { select: { user: { select: { firstName: true } } } },
      },
    }),
    db.journalEntry.findMany({
      where: { alertFlag: true, createdAt: { gte: alertSince }, aine: REAL_AINE },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        alertNote: true,
        visitId: true,
        aine: { select: { firstName: true, commune: true } },
        author: { select: { firstName: true } },
      },
    }),
    db.feedback.findMany({
      where: { status: "NOUVEAU" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, rating: true, message: true, pagePath: true, createdAt: true },
    }),
  ]);
  return {
    counts: { caregiversPending, requestsOpen, requestsOpenStale, requestsProposed, visitsToCheck, alerts, feedbackNew, outboxToday },
    pendingCaregivers,
    openRequests,
    visitsList,
    alertList,
    feedbackList,
  };
}

// ─────────────── O2 / O3 Accompagnants ───────────────

export async function listCaregivers(filters: { validation?: CaregiverValidation; status?: CaregiverStatus }) {
  return db.caregiverProfile.findMany({
    where: { validation: filters.validation, status: filters.status, user: REAL_USER },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      validation: true,
      communes: true,
      allowedLevels: true,
      updatedAt: true,
      user: { select: { firstName: true, lastName: true } },
      verifications: { select: { status: true } },
    },
  });
}

export async function getCaregiver(id: string) {
  return db.caregiverProfile.findFirst({
    where: { id, user: REAL_USER },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true } },
      availabilities: { orderBy: [{ dayOfWeek: "asc" }, { slot: "asc" }] },
      verifications: { orderBy: { type: "asc" }, include: { reviewedBy: { select: { firstName: true } } } },
      reviewedBy: { select: { firstName: true, lastName: true } },
      missions: {
        where: { status: "ACTIVE" },
        select: { id: true, aine: { select: { firstName: true, commune: true } } },
      },
    },
  });
}

/** Historique des décisions sur un profil (journal d'audit), du plus récent au plus ancien. */
export async function caregiverHistory(caregiverId: string, verificationIds: string[]) {
  return db.auditLog.findMany({
    where: {
      OR: [
        { entityType: "CaregiverProfile", entityId: caregiverId },
        { entityType: "VerificationItem", entityId: { in: verificationIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, action: true, createdAt: true, metadata: true, actor: { select: { firstName: true, lastName: true } } },
  });
}

// ─────────────── O4 / O5 Demandes et matching ───────────────

export async function listOpenRequests() {
  return db.careRequest.findMany({
    where: { status: { in: ["OUVERTE", "PROPOSEE"] }, aine: REAL_AINE },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      level: true,
      frequency: true,
      status: true,
      createdAt: true,
      aine: { select: { id: true, firstName: true, lastInitial: true, commune: true } },
      slots: { select: { dayOfWeek: true, slot: true } },
      proposals: { select: { status: true } },
    },
  });
}

export async function getRequestWithCandidates(requestId: string) {
  const request = await db.careRequest.findFirst({
    where: { id: requestId, aine: REAL_AINE },
    include: {
      aine: { select: { id: true, firstName: true, lastInitial: true, territoire: true, commune: true, needs: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      slots: { orderBy: [{ dayOfWeek: "asc" }, { slot: "asc" }] },
      proposals: {
        orderBy: { createdAt: "desc" },
        include: { caregiver: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
      },
      mission: { select: { id: true, caregiver: { select: { user: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  if (!request) return null;

  // Tous les accompagnants du MÊME monde et du MÊME territoire (T1) qui ont un statut (orientation faite).
  const caregivers = await db.caregiverProfile.findMany({
    where: { status: { not: null }, user: REAL_USER, territoire: request.aine.territoire },
    select: {
      id: true,
      status: true,
      validation: true,
      hasDiploma: true,
      territoire: true,
      communes: true,
      allowedLevels: true,
      hourlyRateCents: true,
      linkedAineId: true,
      saadName: true,
      user: { select: { firstName: true, lastName: true } },
      availabilities: { select: { dayOfWeek: true, slot: true } },
    },
  });
  const proposalByCaregiver = new Map(request.proposals.map((p) => [p.caregiverId, p.status]));
  const candidates = sortCandidates(
    caregivers.map((c) => ({
      name: `${c.user.firstName} ${c.user.lastName}`,
      match: checkCompatibility(c, {
        territoire: request.aine.territoire,
        level: request.level,
        commune: request.aine.commune,
        slots: request.slots,
        aineId: request.aine.id,
      }),
      data: { ...c, proposalStatus: proposalByCaregiver.get(c.id) ?? null },
    })),
  );
  return { request, candidates };
}

// ─────────────── O6 Visites ───────────────

export type VisitFilter = { status?: VisitStatus; signal?: boolean };

export async function listVisits(f: VisitFilter) {
  await sweepOverdueVisits({ aine: REAL_AINE });
  const where: Prisma.VisitWhereInput = { status: f.status, aine: REAL_AINE };
  if (f.signal) where.journal = { is: { alertFlag: true } };
  return db.visit.findMany({
    where,
    orderBy: { scheduledStart: "desc" },
    take: 100,
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      proofScore: true,
      checkInAt: true,
      checkOutAt: true,
      aine: { select: { id: true, firstName: true, lastInitial: true, commune: true } },
      caregiver: { select: { user: { select: { firstName: true, lastName: true } } } },
      proofs: { select: { factor: true, valid: true, simulated: true, distanceMeters: true } },
      journal: { select: { id: true, alertFlag: true, alertNote: true } },
    },
  });
}

/** Résumé d'une visite après une confirmation simulée (bandeau en haut de la liste). */
export async function getVisitSummary(id: string) {
  return db.visit.findFirst({
    where: { id, aine: REAL_AINE },
    select: { id: true, status: true, proofScore: true, scheduledStart: true, aine: { select: { firstName: true } } },
  });
}

export async function visitStatusCounts() {
  const rows = await db.visit.groupBy({ by: ["status"], where: { aine: REAL_AINE }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<VisitStatus, number>>;
}

// ─────────────── O7 Boîte d'envoi ───────────────

export async function listOutbox(f: { channel?: Channel; template?: string }) {
  return db.outboxMessage.findMany({
    where: { channel: f.channel, template: f.template, sandboxId: REAL_WORLD },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { recipient: { select: { firstName: true, lastName: true, role: true } } },
  });
}

export async function outboxTemplates() {
  const rows = await db.outboxMessage.findMany({
    where: { sandboxId: REAL_WORLD },
    distinct: ["template"],
    select: { template: true },
    orderBy: { template: "asc" },
  });
  return rows.map((r) => r.template);
}

// ─────────────── O8 Retours testeurs ───────────────

export async function listFeedback(f: { status?: FeedbackStatus }) {
  return db.feedback.findMany({
    where: { status: f.status },
    // Les nouveaux d'abord, puis les plus récents.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}

export async function feedbackCounts() {
  const rows = await db.feedback.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<FeedbackStatus, number> = { NOUVEAU: 0, LU: 0, TRAITE: 0 };
  for (const r of rows) counts[r.status] = r._count._all;
  const agg = await db.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } });
  return { counts, total: agg._count._all, average: agg._avg.rating };
}

// ─────────────── O9 Journal d'audit ───────────────

export async function listAudit(f: { action?: string; entityType?: string }) {
  return db.auditLog.findMany({
    where: { action: f.action, entityType: f.entityType, ...REAL_ACTOR },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { firstName: true, lastName: true } } },
  });
}

export async function auditFacets() {
  const [actions, entities] = await Promise.all([
    db.auditLog.findMany({ where: REAL_ACTOR, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ where: REAL_ACTOR, distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), entityTypes: entities.map((e) => e.entityType) };
}

// ─────────────── O10 Mesure du test (D15) ───────────────

/**
 * Tableau de bord de la mesure du test. Regroupe TOUS les bacs à sable (exception voulue au
 * cloisonnement) : codes testeurs, événements d'usage, micro-questions, offre factice, avis.
 */
export async function getTestMeasure(now: Date = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [sandboxes, byRole, activeWeek, events, pages, micro, discoveries, declined, feedbackByCode, sandboxesByCode, steps] = await Promise.all([
    db.sandbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, testerCode: true, role: true, createdAt: true, lastSeenAt: true, simulationCount: true },
    }),
    db.sandbox.groupBy({ by: ["role"], _count: { _all: true } }),
    db.sandbox.count({ where: { lastSeenAt: { gte: weekAgo } } }),
    db.usageEvent.groupBy({ by: ["name"], _count: { _all: true }, orderBy: { name: "asc" } }),
    db.usageEvent.groupBy({
      by: ["path"],
      where: { name: "page.view" },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 15,
    }),
    db.microAnswer.groupBy({ by: ["questionKey", "answer"], _count: { _all: true }, orderBy: [{ questionKey: "asc" }, { answer: "asc" }] }),
    db.discoveryRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, contact: true, testerCode: true, createdAt: true, consentAt: true, status: true },
    }),
    db.usageEvent.count({ where: { name: "discovery.declined" } }),
    db.feedback.groupBy({ by: ["testerCode"], where: { testerCode: { not: null } }, _count: { _all: true }, _avg: { rating: true } }),
    db.sandbox.groupBy({ by: ["testerCode"], _count: { _all: true }, orderBy: { testerCode: "asc" } }),
    db.usageEvent.findMany({ where: { name: "simulate.step" }, select: { metadata: true }, take: 5000 }),
  ]);
  const stepCounts = new Map<string, number>();
  for (const e of steps) {
    const step = (e.metadata as { step?: string } | null)?.step ?? "?";
    stepCounts.set(step, (stepCounts.get(step) ?? 0) + 1);
  }
  const families = byRole.find((r) => r.role === "FAMILLE")?._count._all ?? 0;
  return {
    totals: {
      sandboxes: byRole.reduce((n, r) => n + r._count._all, 0),
      families,
      caregivers: byRole.find((r) => r.role === "ACCOMPAGNANT")?._count._all ?? 0,
      activeWeek,
      discoveries: discoveries.length,
      declined,
    },
    sandboxes,
    events: events.map((e) => ({ name: e.name, count: e._count._all })),
    pages: pages.map((p) => ({ path: p.path ?? "—", count: p._count._all })),
    steps: [...stepCounts.entries()].sort((a, b) => b[1] - a[1]).map(([step, count]) => ({ step, count })),
    micro: micro.map((m) => ({ questionKey: m.questionKey, answer: m.answer, count: m._count._all })),
    discoveries,
    codes: sandboxesByCode.map((c) => {
      const fb = feedbackByCode.find((f) => f.testerCode === c.testerCode);
      return { code: c.testerCode, sandboxes: c._count._all, feedbacks: fb?._count._all ?? 0, avgRating: fb?._avg.rating ?? null };
    }),
  };
}
