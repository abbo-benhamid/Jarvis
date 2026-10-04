import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyLakou, notifyUser } from "@/server/outbox";
import { checkCompatibility, MAX_PROFILES_PER_REQUEST } from "@/server/rules/matching";
import { proposalBlockReason } from "@/server/operateur/rules";
import { sameScope, type Scope } from "@/server/scope";
import { communeLabel } from "@/lib/communes";

/**
 * Flux D6 (anti-subordination) : Koudmen PROPOSE 1 à 3 profils, la FAMILLE CHOISIT,
 * l'ACCOMPAGNANT ACCEPTE ou refuse. Koudmen ne choisit jamais à la place de l'employeur.
 *
 *   PROPOSEE_FAMILLE --(la famille choisit)--> EN_ATTENTE --(l'accompagnant accepte)--> ACCEPTEE
 *                                                        \--(refuse, sans pénalité)--> REFUSEE
 *
 * Ces fonctions servent à l'opérateur réel ET aux robots des bacs à sable (D14).
 * Le paramètre `scope` cloisonne les mondes (D2) : une demande et un profil de deux mondes
 * différents ne se rencontrent jamais.
 */

export type MatchingActor = { id: string; role: Role };

export class MatchingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchingError";
  }
}

/** Propositions qui occupent une place parmi les 3 profils montrés à la famille. */
const ACTIVE: ("PROPOSEE_FAMILLE" | "EN_ATTENTE")[] = ["PROPOSEE_FAMILLE", "EN_ATTENTE"];

/**
 * Koudmen propose UN profil à la famille (statut PROPOSEE_FAMILLE).
 * Règles serveur : même monde, demande ouverte, compatibilité recalculée (RM-01, RM-02, D7),
 * 3 profils actifs au maximum, une seule proposition par accompagnant et par demande.
 */
export async function proposeProfile(
  actor: MatchingActor,
  input: { requestId: string; caregiverId: string; message?: string | null },
  scope: Scope,
): Promise<{ proposalId: string; caregiverName: string; activeCount: number }> {
  const { requestId, caregiverId } = input;
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.careRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          level: true,
          status: true,
          aineId: true,
          aine: { select: { firstName: true, commune: true, sandboxId: true } },
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
      const active = await tx.missionProposal.count({ where: { requestId, status: { in: ACTIVE } } });
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
    });
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
 */
export async function chooseProfile(actor: MatchingActor, proposalId: string, now: Date = new Date()) {
  return db.$transaction(async (tx) => {
    const p = await tx.missionProposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        status: true,
        requestId: true,
        request: { select: { level: true, status: true, aineId: true, aine: { select: { commune: true } } } },
        caregiver: { select: { id: true, user: { select: { id: true, firstName: true } } } },
      },
    });
    if (!p) throw new MatchingError("Profil introuvable.");
    if (p.status !== "PROPOSEE_FAMILLE") throw new MatchingError("Ce profil n'est plus à choisir.");
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
  });
}
