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
 * (contact réel, consentement explicite) restent aussi : elles suivent leur propre durée de conservation
 * (purgeRetention ci-dessous).
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

// ─────────────────────────────── Durées de conservation (M6) ───────────────────────────────

/** Contacts « visite découverte » : au plus 6 mois (consentement ; retrait possible par lien). */
export const DISCOVERY_RETENTION_MONTHS = 6;
/** Avis, mesure d'usage, micro-réponses : jusqu'à la fin du test + 6 mois. */
export const TEST_DATA_RETENTION_MONTHS = 6;

/** Ajoute des mois (UTC). */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

/** TEST_END_DATE (AAAA-MM-JJ) → fin de la journée UTC. Null si absente ou invalide. */
export function parseTestEndDate(raw: string | null | undefined): Date | null {
  const s = raw?.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date à partir de laquelle avis et mesures sont effacés : fin du test + 6 mois. Null sans date de fin. */
export function testDataDeadline(testEnd: Date | null): Date | null {
  return testEnd ? addMonths(testEnd, TEST_DATA_RETENTION_MONTHS) : null;
}

export type RetentionResult = { discoveries: number; feedbacks: number; usageEvents: number; microAnswers: number; rateLimits: number };

/**
 * Applique les durées de conservation (purge nocturne) :
 * - demandes « visite découverte » de plus de 6 mois ;
 * - à partir de « fin du test + 6 mois » : TOUS les avis, événements d'usage et micro-réponses ;
 * - compteurs de limite de débit expirés.
 */
export async function purgeRetention(client: PrismaClient, now: Date = new Date(), testEnd: Date | null = null): Promise<RetentionResult> {
  const discoveries = await client.discoveryRequest.deleteMany({ where: { createdAt: { lt: addMonths(now, -DISCOVERY_RETENTION_MONTHS) } } });
  const deadline = testDataDeadline(testEnd);
  let feedbacks = 0;
  let usageEvents = 0;
  let microAnswers = 0;
  if (deadline && now >= deadline) {
    feedbacks = (await client.feedback.deleteMany({ where: { createdAt: { lt: now } } })).count;
    usageEvents = (await client.usageEvent.deleteMany({ where: { createdAt: { lt: now } } })).count;
    microAnswers = (await client.microAnswer.deleteMany({ where: { createdAt: { lt: now } } })).count;
  }
  const rateLimits = (await client.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  return { discoveries: discoveries.count, feedbacks, usageEvents, microAnswers, rateLimits };
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
