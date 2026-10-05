import "server-only";
import { db } from "@/server/db";
import { purgeRefreshTokens } from "@/server/auth/token-service";
import { purgeAppEvents } from "@/server/visits/app-service";
import { purgePushDevices } from "@/server/notifications/push/service";

/**
 * V1c (code M8, sécurité PM4, arbitrage X9) : durées de conservation des données de l'app,
 * appliquées par la purge nocturne (`/api/cron/purge-bacs-a-sable`).
 *
 * - Jetons de renouvellement : 7 jours après expiration ou révocation.
 * - Événements de l'app (`AppEvent`) : 30 jours.
 * - Brouillons de Kayé (`KayeDraft`, données de santé possibles) : effacés si le Kayé est publié,
 *   si le brouillon n'a pas changé depuis 7 jours, ou si la visite est finie depuis 7 jours.
 * - Appareils push révoqués : 30 jours après la révocation.
 */
export const KAYE_DRAFT_RETENTION_DAYS = 7;
const DAY = 86_400_000;

/** Efface les brouillons de Kayé publiés ou trop anciens. Renvoie le nombre effacé. */
export async function purgeKayeDrafts(now: Date = new Date(), keepDays = KAYE_DRAFT_RETENTION_DAYS): Promise<number> {
  const limit = new Date(now.getTime() - keepDays * DAY);
  const r = await db.kayeDraft.deleteMany({
    where: {
      OR: [{ updatedAt: { lt: limit } }, { visit: { journal: { isNot: null } } }, { visit: { scheduledEnd: { lt: limit } } }],
    },
  });
  return r.count;
}

export type AppRetentionResult = { refreshTokens: number; appEvents: number; kayeDrafts: number; pushDevices: number };

/** Applique toutes les durées de conservation de l'app. Aucune donnée personnelle dans le résultat (des nombres). */
export async function purgeAppData(now: Date = new Date()): Promise<AppRetentionResult> {
  return {
    refreshTokens: await purgeRefreshTokens(now),
    appEvents: await purgeAppEvents(now),
    kayeDrafts: await purgeKayeDrafts(now),
    pushDevices: await purgePushDevices(now),
  };
}
