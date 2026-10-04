import "server-only";
import type { CaregiverStatus, CaregiverValidation, Channel, FeedbackStatus, Prisma, VisitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { checkCompatibility } from "@/server/rules/matching";
import { sortCandidates, STALE_REQUEST_DAYS } from "./rules";

/**
 * Lectures de l'espace opérateur. Chaque page appelle requireRole("OPERATEUR") AVANT ces fonctions.
 * L'opérateur voit tout (canAccessAine), mais on ne lit que les champs utiles (minimisation).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fenêtre des Kayé « à surveiller » montrés au tableau de bord. */
export const ALERT_WINDOW_DAYS = 14;

// ─────────────── O1 Tableau de bord ───────────────

export async function getDashboard(now: Date = new Date()) {
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
    db.caregiverProfile.count({ where: { validation: "EN_ATTENTE" } }),
    db.careRequest.count({ where: { status: "OUVERTE" } }),
    db.careRequest.count({ where: { status: "OUVERTE", createdAt: { lt: staleBefore } } }),
    db.careRequest.count({ where: { status: "PROPOSEE" } }),
    db.visit.count({ where: { status: "A_VERIFIER" } }),
    db.journalEntry.count({ where: { alertFlag: true, createdAt: { gte: alertSince } } }),
    db.feedback.count({ where: { status: "NOUVEAU" } }),
    db.outboxMessage.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
    db.caregiverProfile.findMany({
      where: { validation: "EN_ATTENTE" },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: { id: true, status: true, updatedAt: true, user: { select: { firstName: true, lastName: true } } },
    }),
    db.careRequest.findMany({
      where: { status: "OUVERTE" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, level: true, createdAt: true, aine: { select: { firstName: true, commune: true } } },
    }),
    db.visit.findMany({
      where: { status: "A_VERIFIER" },
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
      where: { alertFlag: true, createdAt: { gte: alertSince } },
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
    where: { validation: filters.validation, status: filters.status },
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
  return db.caregiverProfile.findUnique({
    where: { id },
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
    where: { status: { in: ["OUVERTE", "PROPOSEE"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      level: true,
      frequency: true,
      status: true,
      createdAt: true,
      aine: { select: { firstName: true, lastInitial: true, commune: true } },
      slots: { select: { dayOfWeek: true, slot: true } },
      proposals: { select: { status: true } },
    },
  });
}

export async function getRequestWithCandidates(requestId: string) {
  const request = await db.careRequest.findUnique({
    where: { id: requestId },
    include: {
      aine: { select: { id: true, firstName: true, lastInitial: true, commune: true, needs: true } },
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

  // Tous les accompagnants qui ont un statut (les autres n'ont pas fini l'orientation).
  const caregivers = await db.caregiverProfile.findMany({
    where: { status: { not: null } },
    select: {
      id: true,
      status: true,
      validation: true,
      hasDiploma: true,
      communes: true,
      allowedLevels: true,
      hourlyRateCents: true,
      user: { select: { firstName: true, lastName: true } },
      availabilities: { select: { dayOfWeek: true, slot: true } },
    },
  });
  const proposalByCaregiver = new Map(request.proposals.map((p) => [p.caregiverId, p.status]));
  const candidates = sortCandidates(
    caregivers.map((c) => ({
      name: `${c.user.firstName} ${c.user.lastName}`,
      match: checkCompatibility(c, { level: request.level, commune: request.aine.commune, slots: request.slots }),
      data: { ...c, proposalStatus: proposalByCaregiver.get(c.id) ?? null },
    })),
  );
  return { request, candidates };
}

// ─────────────── O6 Visites ───────────────

export type VisitFilter = { status?: VisitStatus; signal?: boolean };

export async function listVisits(f: VisitFilter) {
  const where: Prisma.VisitWhereInput = { status: f.status };
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
      aine: { select: { firstName: true, lastInitial: true, commune: true } },
      caregiver: { select: { user: { select: { firstName: true, lastName: true } } } },
      proofs: { select: { factor: true, valid: true, simulated: true, distanceMeters: true } },
      journal: { select: { id: true, alertFlag: true, alertNote: true } },
    },
  });
}

/** Résumé d'une visite après une confirmation simulée (bandeau en haut de la liste). */
export async function getVisitSummary(id: string) {
  return db.visit.findUnique({
    where: { id },
    select: { id: true, status: true, proofScore: true, scheduledStart: true, aine: { select: { firstName: true } } },
  });
}

export async function visitStatusCounts() {
  const rows = await db.visit.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<VisitStatus, number>>;
}

// ─────────────── O7 Boîte d'envoi ───────────────

export async function listOutbox(f: { channel?: Channel; template?: string }) {
  return db.outboxMessage.findMany({
    where: { channel: f.channel, template: f.template },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { recipient: { select: { firstName: true, lastName: true, role: true } } },
  });
}

export async function outboxTemplates() {
  const rows = await db.outboxMessage.findMany({ distinct: ["template"], select: { template: true }, orderBy: { template: "asc" } });
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
    where: { action: f.action, entityType: f.entityType },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { firstName: true, lastName: true } } },
  });
}

export async function auditFacets() {
  const [actions, entities] = await Promise.all([
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), entityTypes: entities.map((e) => e.entityType) };
}
