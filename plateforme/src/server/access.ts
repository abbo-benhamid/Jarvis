import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/guards";

/**
 * Contrôle d'accès aux données d'un aîné (RGPD : moindre privilège).
 * - OPERATEUR : accès.
 * - FAMILLE : seulement si membre du cercle Lakou.
 * - ACCOMPAGNANT : seulement s'il a une mission ACTIVE ou TERMINEE auprès de cet aîné.
 */
export async function canAccessAine(user: Pick<CurrentUser, "id" | "role">, aineId: string): Promise<boolean> {
  if (user.role === "OPERATEUR") return true;
  if (user.role === "FAMILLE") {
    const m = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId, userId: user.id } } });
    return m !== null;
  }
  const mission = await db.mission.findFirst({
    where: { aineId, caregiver: { userId: user.id }, status: { in: ["ACTIVE", "TERMINEE"] } },
    select: { id: true },
  });
  return mission !== null;
}

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function assertAineAccess(user: Pick<CurrentUser, "id" | "role">, aineId: string): Promise<void> {
  if (!(await canAccessAine(user, aineId))) throw new ForbiddenError();
}

/** Ids des aînés du cercle Lakou d'un membre de la famille. */
export async function familyAineIds(userId: string): Promise<string[]> {
  const rows = await db.lakouMember.findMany({ where: { userId }, select: { aineId: true } });
  return rows.map((r) => r.aineId);
}
