import "server-only";
import { db } from "@/server/db";
import { canAccessAine, familyAineIds } from "@/server/access";
import type { CurrentUser } from "@/server/auth/guards";
import { sweepOverdueVisits } from "@/server/visits/service";
import { invitationState } from "./logic";

/**
 * Lectures de l'espace Famille. Chaque fonction filtre par le cercle Lakou
 * de l'utilisateur (RM-11). Les pages appellent requireRole() AVANT.
 */

const visitInclude = {
  aine: { select: { id: true, firstName: true, lastInitial: true, territoire: true } },
  caregiver: { select: { user: { select: { firstName: true } } } },
  proofs: { select: { factor: true, valid: true, simulated: true } },
  journal: { select: { id: true } },
} as const;

/** F1 : aînés du cercle avec prochaine visite et dernier Kayé. */
export async function getFamilyHome(userId: string, now: Date = new Date()) {
  // Statut cohérent partout : les visites dépassées passent « À vérifier » en base.
  await sweepOverdueVisits({ aine: { members: { some: { userId } } } }, now);
  const memberships = await db.lakouMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      isPayer: true,
      relation: true,
      aine: {
        select: {
          id: true,
          firstName: true,
          lastInitial: true,
          territoire: true,
          commune: true,
          activityLevel: true,
          subscription: { select: { plan: true } },
          _count: { select: { members: true } },
          visits: {
            where: { scheduledStart: { gte: now }, status: { in: ["PREVUE", "EN_COURS"] } },
            orderBy: { scheduledStart: "asc" },
            take: 1,
            select: { id: true, scheduledStart: true, caregiver: { select: { user: { select: { firstName: true } } } } },
          },
          journal: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, mood: true, alertFlag: true, note: true },
          },
          requests: { where: { status: { in: ["OUVERTE", "PROPOSEE"] } }, select: { id: true } },
        },
      },
    },
  });
  const aineIds = memberships.map((m) => m.aine.id);
  const toCheck = aineIds.length
    ? await db.visit.count({ where: { aineId: { in: aineIds }, status: "A_VERIFIER" } })
    : 0;
  return { memberships, visitsToCheck: toCheck };
}

/** F3 : fiche d'un aîné, seulement si l'utilisateur est dans son cercle. Sinon null. */
export async function getAineForFamily(user: CurrentUser, aineId: string) {
  if (!(await canAccessAine(user, aineId))) return null;
  const aine = await db.aine.findUnique({
    where: { id: aineId },
    include: {
      subscription: { select: { plan: true, priceCents: true, payerId: true } },
      members: {
        orderBy: [{ isPayer: "desc" }, { joinedAt: "asc" }],
        select: { id: true, relation: true, isPayer: true, joinedAt: true, user: { select: { id: true, firstName: true, lastName: true } } },
      },
      _count: { select: { requests: true } },
    },
  });
  if (!aine) return null;
  const me = aine.members.find((m) => m.user.id === user.id);
  return { aine, isPayer: Boolean(me?.isPayer) };
}

/** F4 : invitations de l'aîné (accès vérifié par l'appelant). */
export async function getInvitations(aineId: string) {
  return db.invitation.findMany({
    // A6 : les liens « proche aidant » ne sont pas des invitations au cercle.
    where: { aineId, kind: "LAKOU" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      token: true,
      email: true,
      relation: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
      createdBy: { select: { firstName: true } },
      acceptedBy: { select: { firstName: true } },
    },
  });
}

/** Aînés du cercle (pour les listes de choix et les filtres). */
export async function getFamilyAines(userId: string) {
  const rows = await db.lakouMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { isPayer: true, aine: { select: { id: true, firstName: true, lastInitial: true, activityLevel: true, commune: true, accordEtat: true } } },
  });
  return rows.map((r) => ({ ...r.aine, isPayer: r.isPayer }));
}

/** F5 : demandes des aînés du cercle. Pas de détail des refus d'accompagnant. */
export async function getFamilyRequests(userId: string) {
  const aineIds = await familyAineIds(userId);
  if (aineIds.length === 0) return [];
  return db.careRequest.findMany({
    where: { aineId: { in: aineIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      level: true,
      frequency: true,
      durationMinutes: true,
      startDate: true,
      notes: true,
      status: true,
      createdAt: true,
      aine: { select: { id: true, firstName: true, lastInitial: true } },
      createdById: true,
      createdBy: { select: { firstName: true } },
      slots: { select: { dayOfWeek: true, slot: true }, orderBy: [{ dayOfWeek: "asc" }, { slot: "asc" }] },
      employerType: true,
      employerName: true,
      // D6 : profils proposés par Koudmen (à choisir) et profil choisi (en attente de réponse).
      // Jamais le nom ni le motif d'un refus (RM-05).
      proposals: {
        where: { status: { in: ["PROPOSEE_FAMILLE", "EN_ATTENTE"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          message: true,
          caregiver: {
            select: {
              status: true,
              saadName: true,
              associationName: true,
              communes: true,
              hourlyRateCents: true,
              bio: true,
              availabilities: { select: { dayOfWeek: true, slot: true } },
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      mission: { select: { caregiver: { select: { status: true, saadName: true, user: { select: { firstName: true, lastName: true } } } } } },
    },
  });
}

/** F7 : visites des aînés du cercle. */
export async function getFamilyVisits(userId: string, aineId?: string) {
  const aineIds = await familyAineIds(userId);
  const ids = aineId ? aineIds.filter((x) => x === aineId) : aineIds;
  if (ids.length === 0) return [];
  await sweepOverdueVisits({ aineId: { in: ids } });
  return db.visit.findMany({
    where: { aineId: { in: ids } },
    orderBy: { scheduledStart: "desc" },
    take: 60,
    include: visitInclude,
  });
}

/** F8 : fil Kayé des aînés du cercle, du plus récent au plus ancien. */
export async function getKayeFeed(userId: string, opts: { aineId?: string; onlySignals?: boolean } = {}) {
  const aineIds = await familyAineIds(userId);
  const ids = opts.aineId ? aineIds.filter((x) => x === opts.aineId) : aineIds;
  if (ids.length === 0) return [];
  return db.journalEntry.findMany({
    where: { aineId: { in: ids }, ...(opts.onlySignals ? { alertFlag: true } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      mood: true,
      activities: true,
      appetite: true,
      note: true,
      alertFlag: true,
      alertNote: true,
      createdAt: true,
      aine: { select: { id: true, firstName: true } },
      author: { select: { firstName: true } },
      // S1c (affichage) : le reçu de visite en tête du Kayé (S1b-ux M6) lit aussi l'arrivée et les preuves.
      visit: { select: { scheduledStart: true, proofScore: true, status: true, checkInAt: true, proofs: { select: { factor: true, valid: true } } } },
    },
  });
}

/** Nombre de signaux « à surveiller » des 30 derniers jours, par aîné du cercle. */
export async function countRecentSignals(userId: string, now: Date = new Date()) {
  const aineIds = await familyAineIds(userId);
  if (aineIds.length === 0) return 0;
  return db.journalEntry.count({
    where: { aineId: { in: aineIds }, alertFlag: true, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
  });
}

/** F9 : formule et paiements simulés d'un aîné du cercle. */
export async function getPlanContext(user: CurrentUser, aineId: string) {
  const access = await getAineForFamily(user, aineId);
  if (!access) return null;
  const payments = await db.simulatedPayment.findMany({
    where: { subscription: { aineId } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, amountCents: true, status: true, createdAt: true },
  });
  return { ...access, payments };
}

/** F10 : invitation par jeton (page publique). Ne renvoie que le strict nécessaire. */
export async function getInvitationByToken(token: string, now: Date = new Date()) {
  const inv = await db.invitation.findFirst({
    where: { token, kind: "LAKOU" },
    select: {
      id: true,
      aineId: true,
      relation: true,
      expiresAt: true,
      acceptedAt: true,
      aine: { select: { firstName: true, lastInitial: true, sandboxId: true } },
      createdBy: { select: { firstName: true } },
    },
  });
  if (!inv) return null;
  return { ...inv, state: invitationState(inv, now) };
}

/** A6 : lien « proche aidant » (page publique /proche-aidant/[token]). */
export async function getCaregiverLinkInvitation(token: string, now: Date = new Date()) {
  const inv = await db.invitation.findFirst({
    where: { token, kind: "PROCHE_AIDANT" },
    select: {
      id: true,
      aineId: true,
      expiresAt: true,
      acceptedAt: true,
      aine: { select: { firstName: true, sandboxId: true } },
      createdBy: { select: { firstName: true } },
    },
  });
  if (!inv) return null;
  return { ...inv, state: invitationState(inv, now) };
}

export async function isLakouMember(aineId: string, userId: string): Promise<boolean> {
  const m = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId, userId } }, select: { id: true } });
  return m !== null;
}
