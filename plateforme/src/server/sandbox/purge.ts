/**
 * Purge des bacs à sable (D2). Sans `server-only` : utilisé par la route du cron
 * (/api/cron/purge-bacs-a-sable) ET par le script `pnpm ops:purge-sandboxes`.
 */
import type { PrismaClient } from "@prisma/client";

/** Durée de vie d'un bac à sable : purge après 30 jours. */
export const SANDBOX_TTL_DAYS = 30;

/**
 * Efface TOUT le monde des bacs à sable donnés (comptes, aînés, demandes, visites, Kayé, messages).
 * Les retours testeurs, les événements d'usage et les réponses aux micro-questions restent,
 * rattachés au seul code testeur (plus aucun compte). Les demandes de visite découverte
 * (contact réel, consentement explicite) restent aussi : elles suivent leur propre durée de conservation.
 */
export async function purgeSandboxIds(client: PrismaClient, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const users = (await client.user.findMany({ where: { sandboxId: { in: ids } }, select: { id: true } })).map((u) => u.id);
  const aines = (await client.aine.findMany({ where: { sandboxId: { in: ids } }, select: { id: true } })).map((a) => a.id);
  await client.$transaction(
    async (tx) => {
      await tx.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityType: "Sandbox", entityId: { in: ids } }] } });
      await tx.outboxMessage.deleteMany({ where: { OR: [{ sandboxId: { in: ids } }, { recipientUserId: { in: users } }] } });
      await tx.journalEntry.deleteMany({ where: { aineId: { in: aines } } });
      await tx.visit.deleteMany({ where: { aineId: { in: aines } } });
      await tx.mission.deleteMany({ where: { aineId: { in: aines } } });
      await tx.missionProposal.deleteMany({ where: { OR: [{ request: { aineId: { in: aines } } }, { proposedById: { in: users } }] } });
      await tx.careRequest.deleteMany({ where: { aineId: { in: aines } } });
      await tx.aine.deleteMany({ where: { id: { in: aines } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
      await tx.sandbox.deleteMany({ where: { id: { in: ids } } });
    },
    { timeout: 60_000 },
  );
  return ids.length;
}

/** Purge des bacs à sable créés il y a plus de 30 jours. */
export async function purgeExpiredSandboxes(client: PrismaClient, now: Date = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - SANDBOX_TTL_DAYS * 86_400_000);
  let total = 0;
  for (;;) {
    const expired = await client.sandbox.findMany({ where: { createdAt: { lt: limit } }, select: { id: true }, take: 100 });
    if (expired.length === 0) return total;
    total += await purgeSandboxIds(client, expired.map((s) => s.id));
  }
}
