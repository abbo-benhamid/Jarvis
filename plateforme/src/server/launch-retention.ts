import "server-only";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { purgeSandboxIds } from "@/server/sandbox/purge";
import { purgeAccountTokens } from "@/server/auth/account-tokens";
import { purgeActivations } from "@/server/offre/activation";

/**
 * L11 / L1-A : purges nocturnes du mode lancement (appelées par /api/cron/purge-bacs-a-sable).
 * - Restes de bac à sable : en lancement, TOUS les bacs à sable sont effacés (pas d'attente des 30 jours).
 * - Jetons de compte expirés ou utilisés (L3).
 * - J29 : comptes jamais confirmés depuis 7 jours (sans aîné, sans demande, sans mission).
 * - J35 : demandes de rappel sans suite depuis 3 mois.
 */
export const UNVERIFIED_ACCOUNT_DAYS = 7;

export async function purgeAllSandboxes(client: PrismaClient = db): Promise<number> {
  const ids = (await client.sandbox.findMany({ select: { id: true } })).map((s) => s.id);
  return purgeSandboxIds(client, ids);
}

export async function purgeUnverifiedAccounts(now: Date = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - UNVERIFIED_ACCOUNT_DAYS * 86_400_000);
  const r = await db.user.deleteMany({
    where: {
      emailVerifiedAt: null,
      createdAt: { lt: limit },
      isDemo: false,
      sandboxId: null,
      role: { in: ["FAMILLE", "ACCOMPAGNANT"] },
      ownedAines: { none: {} },
      lakouMemberships: { none: {} },
      careRequests: { none: {} },
      OR: [{ caregiverProfile: null }, { caregiverProfile: { missions: { none: {} }, proposals: { none: {} }, visits: { none: {} } } }],
    },
  });
  return r.count;
}

export type LaunchPurgeResult = { sandboxes: number; accountTokens: number; unverifiedAccounts: number; activations: number };

export async function purgeLaunchData(launch: boolean, now: Date = new Date()): Promise<LaunchPurgeResult> {
  return {
    sandboxes: launch ? await purgeAllSandboxes() : 0,
    accountTokens: await purgeAccountTokens(now),
    unverifiedAccounts: await purgeUnverifiedAccounts(now),
    activations: await purgeActivations(now),
  };
}
