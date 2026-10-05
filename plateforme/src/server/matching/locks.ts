import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Verrous et erreurs de concurrence (m1).
 * RÈGLE D'ORDRE : dans CHAQUE transaction qui touche une demande et ses propositions, verrouiller
 * D'ABORD la ligne CareRequest (SELECT … FOR UPDATE), puis écrire les propositions. Plusieurs demandes :
 * dans l'ordre croissant des id. Cet ordre unique évite les deadlocks (40P01) entre
 * proposer, choisir, accepter, refuser, annuler et suspendre.
 */
export async function lockCareRequests(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT "id" FROM "CareRequest" WHERE "id" = ${id} FOR UPDATE`;
  }
}

/** Erreur de concurrence PostgreSQL ou Prisma : conflit d'écriture, deadlock, sérialisation. */
export function isConcurrencyError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2034") return true;
    if (e.code === "P2010") {
      const code = (e.meta as { code?: string } | undefined)?.code;
      return code === "40P01" || code === "40001";
    }
  }
  const msg = e instanceof Error ? e.message : "";
  return /40P01|40001|deadlock detected|could not serialize/i.test(msg);
}
