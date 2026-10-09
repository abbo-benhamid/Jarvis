import "server-only";
import { db } from "@/server/db";
import { sweepOverdueVisits } from "@/server/visits/service";
import { planVisits } from "./schedule";
import { fuseauDe } from "@/lib/territoires";
import { getOrCreateProfile, ownedVisitWhere } from "./service";
import type { ProfileSnapshot } from "./rules";

/**
 * Lectures du Lot B. Chaque requête filtre par l'utilisateur connecté :
 * un accompagnant ne lit JAMAIS les données d'un autre accompagnant.
 * Le code domicile de l'aîné n'est jamais renvoyé.
 */

export async function getProfile(userId: string) {
  return getOrCreateProfile(userId);
}

export function profileSnapshot(p: Awaited<ReturnType<typeof getProfile>>): ProfileSnapshot {
  return {
    status: p.status,
    communes: p.communes,
    availabilityCount: p.availabilities.length,
    hourlyRateCents: p.hourlyRateCents,
    associationName: p.associationName,
    saadName: p.saadName,
    siret: p.siret,
  };
}

const VISIT_LIST_SELECT = {
  id: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  proofScore: true,
  checkInAt: true,
  checkOutAt: true,
  aine: { select: { firstName: true, lastInitial: true, commune: true } },
  journal: { select: { id: true } },
} as const;

export async function getDashboard(userId: string, now: Date = new Date()) {
  const profile = await getOrCreateProfile(userId);
  // Statut cohérent partout : les visites dépassées passent « À vérifier » en base.
  await sweepOverdueVisits({ caregiverId: profile.id }, now);
  const startOfToday = new Date(now.getTime() - 12 * 3_600_000);
  const [pendingProposals, nextVisits, kayeToWrite] = await Promise.all([
    db.missionProposal.count({ where: { caregiverId: profile.id, status: "EN_ATTENTE" } }),
    db.visit.findMany({
      where: { caregiverId: profile.id, scheduledStart: { gte: startOfToday }, checkOutAt: null },
      orderBy: { scheduledStart: "asc" },
      take: 3,
      select: VISIT_LIST_SELECT,
    }),
    db.visit.count({ where: { caregiverId: profile.id, checkInAt: { not: null }, journal: { is: null } } }),
  ]);
  return { profile, pendingProposals, nextVisits, kayeToWrite };
}

export async function getPendingProposals(userId: string, now: Date = new Date()) {
  const profile = await getOrCreateProfile(userId);
  const proposals = await db.missionProposal.findMany({
    where: { caregiverId: profile.id, status: "EN_ATTENTE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      message: true,
      createdAt: true,
      request: {
        select: {
          level: true,
          frequency: true,
          durationMinutes: true,
          startDate: true,
          notes: true,
          slots: { select: { dayOfWeek: true, slot: true }, orderBy: [{ dayOfWeek: "asc" }] },
          aine: { select: { firstName: true, commune: true, territoire: true } },
        },
      },
    },
  });
  return {
    profile,
    proposals: proposals.map((p) => ({
      ...p,
      plannedVisits: planVisits(
        {
          frequency: p.request.frequency,
          durationMinutes: p.request.durationMinutes,
          startDate: p.request.startDate,
          slots: p.request.slots,
          timeZone: fuseauDe(p.request.aine.territoire),
        },
        now,
      ).length,
    })),
  };
}

export async function getVisits(userId: string, now: Date = new Date()) {
  const profile = await getOrCreateProfile(userId);
  await sweepOverdueVisits({ caregiverId: profile.id }, now);
  const cutoff = new Date(now.getTime() - 12 * 3_600_000);
  const [upcoming, past] = await Promise.all([
    db.visit.findMany({
      where: { caregiverId: profile.id, scheduledStart: { gte: cutoff }, checkOutAt: null },
      orderBy: { scheduledStart: "asc" },
      take: 40,
      select: VISIT_LIST_SELECT,
    }),
    db.visit.findMany({
      where: { caregiverId: profile.id, OR: [{ scheduledStart: { lt: cutoff } }, { checkOutAt: { not: null } }] },
      orderBy: { scheduledStart: "desc" },
      take: 20,
      select: VISIT_LIST_SELECT,
    }),
  ]);
  return { upcoming, past };
}

/** Détail d'une visite de CET accompagnant (null sinon). Sans le code domicile. */
export async function getOwnedVisit(userId: string, visitId: string) {
  return db.visit.findFirst({
    where: ownedVisitWhere(userId, visitId),
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      proofScore: true,
      checkInAt: true,
      checkOutAt: true,
      aine: { select: { firstName: true, lastInitial: true, commune: true, addressHint: true } },
      proofs: { select: { factor: true, valid: true, simulated: true, distanceMeters: true, details: true } },
      journal: {
        select: {
          mood: true,
          activities: true,
          appetite: true,
          note: true,
          alertFlag: true,
          alertNote: true,
          createdAt: true,
        },
      },
    },
  });
}
