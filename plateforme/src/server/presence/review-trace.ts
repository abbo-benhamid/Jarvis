import "server-only";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";

/**
 * L1d (M7) : trace d'un signalement « Non, je signale un problème ». La visite reste « À vérifier »
 * (l'équipe Koudmen tranche) : après un rechargement, la famille voit « Signalé le … », pas la question.
 * Source : le journal d'audit `visit.review.reported` (écrit par `decideVisitReview`).
 */
export async function reportedVisits(visitIds: string[]): Promise<Map<string, string>> {
  if (visitIds.length === 0) return new Map();
  const rows = await db.auditLog.findMany({
    where: { action: "visit.review.reported", entityType: "Visit", entityId: { in: visitIds } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, createdAt: true },
  });
  const out = new Map<string, string>();
  for (const r of rows) if (r.entityId && !out.has(r.entityId)) out.set(r.entityId, formatDateTime(r.createdAt));
  return out;
}
