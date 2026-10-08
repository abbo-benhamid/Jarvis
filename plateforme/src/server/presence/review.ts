import "server-only";
import type { Role, VisitStatus } from "@prisma/client";
import { CONTESTATION_HOURS, contestationOpen } from "@/server/visits/proof";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { sameScope } from "@/server/scope";
import { formatDate } from "@/lib/format";
import { recordProof, refreshVisitStatus } from "@/server/visits/service";

/**
 * L1-B (R7) : une visite « À vérifier » est TRANCHÉE par la famille employeur (payeur du profil de l'aîné),
 * dans l'espace famille. Pas par l'opérateur.
 * - CONFIRMER : la famille confirme que la visite a eu lieu → facteur « confirmation » valide (2 preuves sur 3 possibles).
 * - SIGNALER : la famille signale un problème → journal + message aux opérateurs. La visite reste « À vérifier ».
 */

export type ReviewDecision = "CONFIRMER" | "SIGNALER";
export type ReviewActor = { id: string; role: Role; firstName: string; sandboxId: string | null };

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

/** La famille employeur : le payeur du profil de l'aîné. */
export function isEmployer(userId: string, members: { userId: string; isPayer: boolean }[]): boolean {
  return members.some((m) => m.userId === userId && m.isPayer);
}

/**
 * L1d (D4) : contestation d'une « Présence probable » par la famille employeur, 48 h au plus après le check-in.
 * Effets : `contestedAt`, statut recalculé (À vérifier), opérateurs prévenus, journal.
 */
async function contest(
  actor: ReviewActor,
  visit: { id: string; status: VisitStatus; checkInAt: Date | null; scheduledStart: Date; contestedAt: Date | null; aine: { firstName: string } },
  now: Date,
) {
  if (!contestationOpen(visit, now)) {
    throw new ReviewError(`Le délai de contestation (${CONTESTATION_HOURS} heures) est passé. Appelez l'équipe Koudmen.`);
  }
  const r = await db.visit.updateMany({ where: { id: visit.id, contestedAt: null, status: "PRESENCE_PROBABLE" }, data: { contestedAt: now } });
  if (r.count !== 1) throw new ReviewError("Cette visite est déjà contestée.");
  const updated = await refreshVisitStatus(visit.id, now);
  await logAudit({ actor, action: "visit.review.contested", entityType: "Visit", entityId: visit.id, metadata: { status: updated.status } });
  await notifyOperators(actor, visit);
  return { status: updated.status };
}

async function notifyOperators(actor: ReviewActor, visit: { id: string; scheduledStart: Date; aine: { firstName: string } }) {
  const operators = await db.user.findMany({ where: { role: "OPERATEUR", sandboxId: actor.sandboxId }, select: { id: true }, take: 20 });
  for (const op of operators) {
    await notifyUser(op.id, "VISITE_SIGNALEE", { aine: visit.aine.firstName, date: formatDate(visit.scheduledStart) }, { type: "Visit", id: visit.id });
  }
}

export async function decideVisitReview(actor: ReviewActor, visitId: string, decision: ReviewDecision, now: Date = new Date()) {
  if (actor.role !== "FAMILLE") throw new ReviewError("Seule la famille employeur peut trancher une visite.");
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      checkInAt: true,
      contestedAt: true,
      aineId: true,
      aine: { select: { firstName: true, sandboxId: true, members: { select: { userId: true, isPayer: true } } } },
      proofs: { select: { factor: true, valid: true } },
    },
  });
  if (!visit || !sameScope(visit.aine.sandboxId, actor.sandboxId) || !visit.aine.members.some((m) => m.userId === actor.id)) {
    throw new ReviewError("Nous ne trouvons pas cette visite dans votre cercle Lakou.");
  }
  if (!isEmployer(actor.id, visit.aine.members)) {
    throw new ReviewError("Seul le gestionnaire principal du profil (l'employeur) peut trancher cette visite.");
  }
  if (visit.proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid)) throw new ReviewError("Cette visite est déjà confirmée.");
  // L1d (D4) : « Présence probable » → la famille confirme, ou CONTESTE pendant 48 h (SIGNALER).
  if (visit.status === "PRESENCE_PROBABLE") {
    if (decision === "SIGNALER") return contest(actor, visit, now);
  } else if (visit.status !== "A_VERIFIER") {
    throw new ReviewError("Cette visite n'est pas à vérifier.");
  }

  if (decision === "CONFIRMER") {
    const updated = await recordProof(
      visit.id,
      { factor: "CONFIRMATION_AINE", valid: true, simulated: false, details: "Visite confirmée par la famille employeur." },
      actor,
    );
    await logAudit({ actor, action: "visit.review.confirmed", entityType: "Visit", entityId: visit.id, metadata: { status: updated.status } });
    return { status: updated.status };
  }
  await logAudit({ actor, action: "visit.review.reported", entityType: "Visit", entityId: visit.id });
  await notifyOperators(actor, visit);
  return { status: visit.status };
}
