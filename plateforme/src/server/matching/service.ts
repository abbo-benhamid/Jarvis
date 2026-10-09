import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyLakou, notifyUser } from "@/server/outbox";
import { schedulePushFlush } from "@/server/notifications/push/service";
import { checkCompatibility, MAX_PROFILES_PER_REQUEST } from "@/server/rules/matching";
import { proposalBlockReason } from "@/server/operateur/rules";
import { sameScope, type Scope } from "@/server/scope";
import { communeLabel } from "@/lib/territoires";
import { isConcurrencyError, lockCareRequests } from "./locks";

/**
 * Flux D6 (anti-subordination) : Koudmen PROPOSE 1 à 3 profils, la FAMILLE CHOISIT,
 * l'ACCOMPAGNANT ACCEPTE ou refuse. Koudmen ne choisit jamais à la place de l'employeur.
 *
 *   PROPOSEE_FAMILLE --(la famille choisit)--> EN_ATTENTE --(l'accompagnant accepte)--> ACCEPTEE
 *                                                        \--(refuse, sans pénalité)--> REFUSEE
 *   PROPOSEE_FAMILLE | EN_ATTENTE --(suspension, refus de validation, annulation)--> ANNULEE
 *
 * Ces fonctions servent à l'opérateur réel ET aux robots des bacs à sable (D14).
 * Le paramètre `scope` cloisonne les mondes (D2) : une demande et un profil de deux mondes
 * différents ne se rencontrent jamais.
 * Concurrence (m1) : chaque transaction verrouille d'abord la demande (voir ./locks.ts).
 * `client` : transaction de l'appelant (robots : une étape = une transaction). Sinon, une transaction propre.
 */

export type MatchingActor = { id: string; role: Role };
type Tx = Prisma.TransactionClient;

export class MatchingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchingError";
  }
}

/** Propositions qui occupent une place parmi les 3 profils montrés à la famille. */
export const ACTIVE_PROPOSALS: ("PROPOSEE_FAMILLE" | "EN_ATTENTE")[] = ["PROPOSEE_FAMILLE", "EN_ATTENTE"];

/** Exécute `fn` dans la transaction donnée, ou dans une nouvelle. Traduit les conflits de concurrence. */
export async function inTransaction<T>(client: Tx | undefined, fn: (tx: Tx) => Promise<T>, conflictMessage: string): Promise<T> {
  if (client) return fn(client);
  try {
    return await db.$transaction(fn);
  } catch (e) {
    if (isConcurrencyError(e)) throw new MatchingError(conflictMessage);
    throw e;
  }
}

/**
 * Koudmen propose UN profil à la famille (statut PROPOSEE_FAMILLE).
 * Règles serveur : même monde, demande ouverte, compatibilité recalculée (RM-01, RM-02, D7),
 * 3 profils actifs au maximum, une seule proposition par accompagnant et par demande.
 */
export async function proposeProfile(
  actor: MatchingActor,
  input: { requestId: string; caregiverId: string; message?: string | null },
  scope: Scope,
  client?: Tx,
): Promise<{ proposalId: string; caregiverName: string; activeCount: number }> {
  const { requestId, caregiverId } = input;
  try {
    return await inTransaction(
      client,
      async (tx) => {
        // Verrou de la demande d'abord : le maximum de 3 profils tient sous la concurrence.
        await lockCareRequests(tx, [requestId]);
        const request = await tx.careRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            level: true,
            status: true,
            aineId: true,
            aine: { select: { firstName: true, territoire: true, commune: true, sandboxId: true } },
            slots: { select: { dayOfWeek: true, slot: true } },
          },
        });
        const cg = await tx.caregiverProfile.findUnique({
          where: { id: caregiverId },
          select: {
            id: true,
            status: true,
            validation: true,
            hasDiploma: true,
            territoire: true,
            communes: true,
            linkedAineId: true,
            availabilities: { select: { dayOfWeek: true, slot: true } },
            user: { select: { firstName: true, lastName: true, sandboxId: true } },
          },
        });
        // Cloisonnement : hors de son monde, une demande ou un profil « n'existe pas ».
        if (!request || !cg || !sameScope(request.aine.sandboxId, scope) || !sameScope(cg.user.sandboxId, scope)) {
          throw new MatchingError("Demande ou accompagnant introuvable.");
        }
        // RÈGLE SERVEUR : compatibilité recalculée ici. Le formulaire ne fait jamais foi (RM-01, RM-02, D7).
        const match = checkCompatibility(cg, {
          territoire: request.aine.territoire,
          level: request.level,
          commune: request.aine.commune,
          slots: request.slots,
          aineId: request.aineId,
        });
        const existing = await tx.missionProposal.findUnique({
          where: { requestId_caregiverId: { requestId, caregiverId } },
          select: { status: true },
        });
        // Demande close, profil incompatible, ou déjà proposé (pas de relance après un refus : RM-05).
        const blocked = proposalBlockReason({ requestStatus: request.status, match, existingProposal: existing?.status ?? null });
        if (blocked) throw new MatchingError(blocked);
        const active = await tx.missionProposal.count({ where: { requestId, status: { in: ACTIVE_PROPOSALS } } });
        if (active >= MAX_PROFILES_PER_REQUEST) {
          throw new MatchingError(`La famille a déjà ${MAX_PROFILES_PER_REQUEST} profils à choisir. C'est le maximum.`);
        }

        const proposal = await tx.missionProposal.create({
          data: { requestId, caregiverId, proposedById: actor.id, message: input.message || null, status: "PROPOSEE_FAMILLE" },
        });
        if (request.status === "OUVERTE") {
          await tx.careRequest.update({ where: { id: requestId }, data: { status: "PROPOSEE" } });
        }
        await notifyLakou(
          request.aineId,
          "PROFILS_PROPOSES",
          { aine: request.aine.firstName, nombre: active + 1 },
          { type: "CareRequest", id: requestId },
          tx,
        );
        await logAudit(
          { actor, action: "proposal.created", entityType: "MissionProposal", entityId: proposal.id, metadata: { requestId, caregiverId } },
          tx,
        );
        return { proposalId: proposal.id, caregiverName: `${cg.user.firstName} ${cg.user.lastName}`, activeCount: active + 1 };
      },
      "La demande a changé entre-temps. Rechargez la page.",
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new MatchingError("Ce profil a déjà été proposé pour cette demande.");
    }
    throw e;
  }
}

/**
 * La famille CHOISIT un profil proposé (D6). L'appelant a DÉJÀ vérifié que l'acteur
 * est dans le cercle Lakou de l'aîné (canAccessAine).
 * Un seul profil choisi à la fois : si l'accompagnant refuse, la famille en choisit un autre.
 * A1 : un profil qui n'est plus VALIDE (suspendu, refusé) ne peut pas être choisi.
 */
export async function chooseProfile(actor: MatchingActor, proposalId: string, now: Date = new Date(), client?: Tx) {
  const chosen = await inTransaction(
    client,
    async (tx) => {
      const ref = await tx.missionProposal.findUnique({ where: { id: proposalId }, select: { requestId: true } });
      if (!ref) throw new MatchingError("Profil introuvable.");
      // Verrou de la demande d'abord : « un seul profil choisi » tient sous la concurrence.
      await lockCareRequests(tx, [ref.requestId]);
      const p = await tx.missionProposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          status: true,
          requestId: true,
          request: { select: { level: true, status: true, aineId: true, aine: { select: { commune: true } } } },
          caregiver: { select: { id: true, validation: true, user: { select: { id: true, firstName: true } } } },
        },
      });
      if (!p) throw new MatchingError("Profil introuvable.");
      if (p.status !== "PROPOSEE_FAMILLE") throw new MatchingError("Ce profil n'est plus à choisir.");
      if (p.caregiver.validation !== "VALIDE") throw new MatchingError("Ce profil n'est plus disponible. Choisissez un autre profil.");
      if (p.request.status !== "PROPOSEE") throw new MatchingError("Cette demande n'attend plus de choix.");
      const waiting = await tx.missionProposal.count({ where: { requestId: p.requestId, status: "EN_ATTENTE" } });
      if (waiting > 0) throw new MatchingError("Vous avez déjà choisi un profil. Attendez sa réponse.");
      const res = await tx.missionProposal.updateMany({
        where: { id: p.id, status: "PROPOSEE_FAMILLE" },
        data: { status: "EN_ATTENTE", chosenAt: now, chosenById: actor.id },
      });
      if (res.count !== 1) throw new MatchingError("Ce profil n'est plus à choisir.");
      await notifyUser(
        p.caregiver.user.id,
        "PROPOSITION_MISSION",
        { prenom: p.caregiver.user.firstName, niveau: p.request.level, commune: communeLabel(p.request.aine.commune) },
        { type: "MissionProposal", id: p.id },
        tx,
      );
      await logAudit(
        { actor, action: "proposal.chosen", entityType: "MissionProposal", entityId: p.id, metadata: { requestId: p.requestId } },
        tx,
      );
      return { proposalId: p.id, requestId: p.requestId, caregiverFirstName: p.caregiver.user.firstName };
    },
    "La demande a changé entre-temps. Rechargez la page.",
  );
  // Lot N1 : push à l'accompagnant choisi, après la validation. M2 : envoi APRÈS la réponse, jamais attendu.
  // Dans une transaction externe (`client`), le message reste EN_ATTENTE : envoi par la route cron.
  if (!client) schedulePushFlush();
  return chosen;
}

/**
 * La famille ANNULE une demande OUVERTE ou PROPOSEE (M5), en UNE transaction :
 * verrou de la demande → statut contrôlé → propositions actives (PROPOSEE_FAMILLE et EN_ATTENTE) annulées
 * → l'accompagnant choisi reçoit un message neutre → audit.
 * Une acceptation simultanée gagne OU l'annulation gagne : jamais une demande ANNULEE avec une mission.
 */
export async function cancelCareRequest(actor: MatchingActor, requestId: string, now: Date = new Date(), client?: Tx) {
  return inTransaction(
    client,
    async (tx) => {
      await lockCareRequests(tx, [requestId]);
      const req = await tx.careRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, aine: { select: { commune: true } } },
      });
      if (!req) throw new MatchingError("Demande introuvable.");
      const res = await tx.careRequest.updateMany({ where: { id: requestId, status: { in: ["OUVERTE", "PROPOSEE"] } }, data: { status: "ANNULEE" } });
      if (res.count !== 1) throw new MatchingError("Cette demande ne peut plus être annulée.");
      const active = await tx.missionProposal.findMany({
        where: { requestId, status: { in: ACTIVE_PROPOSALS } },
        select: { id: true, status: true, caregiver: { select: { user: { select: { id: true, firstName: true } } } } },
      });
      if (active.length > 0) {
        await tx.missionProposal.updateMany({ where: { id: { in: active.map((p) => p.id) } }, data: { status: "ANNULEE", respondedAt: now } });
      }
      // Seul l'accompagnant CHOISI (EN_ATTENTE) a été prévenu : il reçoit l'annulation. Les autres n'ont rien reçu.
      for (const p of active.filter((x) => x.status === "EN_ATTENTE")) {
        await notifyUser(
          p.caregiver.user.id,
          "DEMANDE_ANNULEE",
          { prenom: p.caregiver.user.firstName, commune: communeLabel(req.aine.commune) },
          { type: "MissionProposal", id: p.id },
          tx,
        );
      }
      await logAudit(
        {
          actor,
          action: "request.cancelled",
          entityType: "CareRequest",
          entityId: requestId,
          metadata: { previousStatus: req.status, cancelledProposals: active.length },
        },
        tx,
      );
      return { cancelledProposals: active.length };
    },
    "La demande a changé entre-temps. Rechargez la page.",
  );
}

export type ReleaseResult = { cancelledProposals: number; suspendedMissions: number; cancelledVisits: number; reopenedRequests: number };

/**
 * A1 : un accompagnant est SUSPENDU ou REFUSÉ. À appeler DANS la transaction de la décision.
 * - Ses propositions EN_ATTENTE et PROPOSEE_FAMILLE sont annulées ; la demande redevient OUVERTE s'il ne reste
 *   aucun profil actif (sinon la famille choisit un autre profil). Le cercle Lakou est prévenu (message anonyme).
 * - Ses missions ACTIVE passent en SUSPENDUE ; ses visites futures (prévues, sans check-in) sont annulées (effacées).
 * - Pour chaque mission suspendue, la demande est ROUVERTE : une copie OUVERTE (même aîné, niveau, fréquence,
 *   créneaux) remplace l'ancienne, qui passe ANNULEE (une demande porte au plus une mission). Le cercle est prévenu.
 */
export async function releaseCaregiver(tx: Tx, caregiverId: string, actor: MatchingActor, now: Date = new Date()): Promise<ReleaseResult> {
  // Verrou des demandes concernées d'abord (ordre unique, voir ./locks.ts), PUIS relecture : une acceptation
  // ou un choix en cours se termine avant, et son résultat est bien pris en compte ici.
  const touched = await tx.missionProposal.findMany({
    where: { caregiverId, OR: [{ status: { in: ACTIVE_PROPOSALS } }, { mission: { status: "ACTIVE" } }] },
    select: { requestId: true },
  });
  await lockCareRequests(tx, touched.map((t) => t.requestId));
  const proposals = await tx.missionProposal.findMany({
    where: { caregiverId, status: { in: ACTIVE_PROPOSALS } },
    select: { id: true, requestId: true },
  });
  const missions = await tx.mission.findMany({
    where: { caregiverId, status: "ACTIVE" },
    select: {
      id: true,
      aineId: true,
      requestId: true,
      aine: { select: { firstName: true } },
      caregiver: { select: { user: { select: { firstName: true } } } },
      request: { include: { slots: { select: { dayOfWeek: true, slot: true } } } },
    },
  });
  // 1. Propositions actives annulées.
  let reopened = 0;
  if (proposals.length > 0) {
    await tx.missionProposal.updateMany({
      where: { id: { in: proposals.map((p) => p.id) }, status: { in: ACTIVE_PROPOSALS } },
      data: { status: "ANNULEE", respondedAt: now },
    });
    for (const requestId of new Set(proposals.map((p) => p.requestId))) {
      const still = await tx.missionProposal.count({ where: { requestId, status: { in: ACTIVE_PROPOSALS } } });
      if (still === 0) {
        const r = await tx.careRequest.updateMany({ where: { id: requestId, status: "PROPOSEE" }, data: { status: "OUVERTE" } });
        reopened += r.count;
      }
      const req = await tx.careRequest.findUnique({ where: { id: requestId }, select: { aineId: true, aine: { select: { firstName: true } } } });
      if (req) {
        await notifyLakou(req.aineId, "PROFIL_INDISPONIBLE", { aine: req.aine.firstName }, { type: "CareRequest", id: requestId }, tx);
      }
    }
  }

  // 2. Missions suspendues, visites futures annulées, demande rouverte.
  let cancelledVisits = 0;
  for (const m of missions) {
    await tx.mission.update({ where: { id: m.id }, data: { status: "SUSPENDUE" } });
    const v = await tx.visit.deleteMany({ where: { missionId: m.id, status: "PREVUE", checkInAt: null, scheduledStart: { gt: now } } });
    cancelledVisits += v.count;
    const r = m.request;
    await tx.careRequest.update({ where: { id: r.id }, data: { status: "ANNULEE" } });
    const reopenedRequest = await tx.careRequest.create({
      data: {
        aineId: r.aineId,
        createdById: r.createdById,
        level: r.level,
        frequency: r.frequency,
        durationMinutes: r.durationMinutes,
        startDate: r.startDate,
        notes: r.notes,
        employerType: r.employerType,
        employerName: r.employerName,
        status: "OUVERTE",
        slots: r.slots.length > 0 ? { create: r.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, slot: s.slot })) } : undefined,
      },
      select: { id: true },
    });
    reopened++;
    await notifyLakou(
      m.aineId,
      "MISSION_SUSPENDUE",
      { aine: m.aine.firstName, accompagnant: m.caregiver.user.firstName },
      { type: "CareRequest", id: reopenedRequest.id },
      tx,
    );
    await logAudit(
      {
        actor,
        action: "mission.suspended",
        entityType: "Mission",
        entityId: m.id,
        metadata: { cancelledVisits: v.count, previousRequestId: r.id, reopenedRequestId: reopenedRequest.id },
      },
      tx,
    );
  }
  return { cancelledProposals: proposals.length, suspendedMissions: missions.length, cancelledVisits, reopenedRequests: reopened };
}
