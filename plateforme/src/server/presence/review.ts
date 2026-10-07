import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { sameScope } from "@/server/scope";
import { formatDate } from "@/lib/format";
import { recordProof } from "@/server/visits/service";

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

export async function decideVisitReview(actor: ReviewActor, visitId: string, decision: ReviewDecision) {
  if (actor.role !== "FAMILLE") throw new ReviewError("Seule la famille employeur peut trancher une visite.");
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
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
  if (visit.status !== "A_VERIFIER") throw new ReviewError("Cette visite n'est pas à vérifier.");
  if (visit.proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid)) throw new ReviewError("Cette visite est déjà confirmée.");

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
  const operators = await db.user.findMany({ where: { role: "OPERATEUR", sandboxId: actor.sandboxId }, select: { id: true }, take: 20 });
  for (const op of operators) {
    await notifyUser(op.id, "VISITE_SIGNALEE", { aine: visit.aine.firstName, date: formatDate(visit.scheduledStart) }, { type: "Visit", id: visit.id });
  }
  return { status: visit.status };
}
