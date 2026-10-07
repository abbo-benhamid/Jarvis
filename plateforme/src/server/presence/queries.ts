import "server-only";
import { db } from "@/server/db";

/**
 * L1-B (R4) : aînés dont l'utilisateur peut suivre le trajet en direct :
 * il est l'employeur (payeur du profil) ou la « personne désignée » (Aine.tripViewerId).
 */
export async function tripViewableAineIds(userId: string): Promise<Set<string>> {
  const rows = await db.lakouMember.findMany({
    where: { userId, OR: [{ isPayer: true }, { aine: { tripViewerId: userId } }] },
    select: { aineId: true },
  });
  return new Set(rows.map((r) => r.aineId));
}
