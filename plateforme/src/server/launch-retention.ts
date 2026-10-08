import "server-only";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { purgeSandboxIds } from "@/server/sandbox/purge";
import { purgeAccountTokens } from "@/server/auth/account-tokens";
import { purgeActivations } from "@/server/offre/activation";
import { mailDeliveryConfigured } from "@/server/mail";
import { logAudit } from "@/server/audit";

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

/**
 * J29 : comptes jamais confirmés depuis 7 jours.
 * L1d (D10, code M5) : AUCUNE purge quand aucun service d'e-mail réel n'est configuré (la personne n'a jamais
 * reçu le lien). Jamais un accompagnant en attente de validation ou validé par l'opérateur, un proche aidant
 * rattaché à son aîné, ni un compte avec une demande de rappel.
 */
export async function purgeUnverifiedAccounts(now: Date = new Date(), mailConfigured: boolean = mailDeliveryConfigured()): Promise<number> {
  if (!mailConfigured) return 0;
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
      activationRequests: { none: {} },
      OR: [
        { caregiverProfile: null },
        {
          caregiverProfile: {
            missions: { none: {} },
            proposals: { none: {} },
            visits: { none: {} },
            validation: { notIn: ["EN_ATTENTE", "VALIDE"] },
            linkedAineId: null,
          },
        },
      ],
    },
  });
  return r.count;
}

/** L1d (D8, sécu M7) : délai avant l'effacement d'une fiche sans accord (jamais appelée avec succès, ou retrait). */
export const AINE_WITHOUT_ACCORD_DAYS = 30;

/**
 * L1d (D8, sécu M7) : fiches d'aînés du monde réel effacées (avec leurs demandes, missions et visites) :
 * - accord REFUSÉ : à la purge suivante ;
 * - accord en attente depuis plus de 30 jours (création) ;
 * - accord RETIRÉ depuis plus de 30 jours.
 * La preuve de la réponse reste dans le journal d'audit (date, conseiller, résultat ; jamais de nom).
 */
export async function purgeAinesWithoutAccord(now: Date = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - AINE_WITHOUT_ACCORD_DAYS * 86_400_000);
  const rows = await db.aine.findMany({
    where: {
      sandboxId: null,
      OR: [
        { accordEtat: "ACCORD_REFUSE" },
        { accordEtat: "EN_ATTENTE_ACCORD", createdAt: { lt: limit } },
        { accordEtat: "ACCORD_RETIRE", OR: [{ accordAt: { lt: limit } }, { accordAt: null, updatedAt: { lt: limit } }] },
      ],
    },
    select: { id: true, accordEtat: true },
    take: 500,
  });
  if (rows.length === 0) return 0;
  const ids = rows.map((r) => r.id);
  await db.$transaction(async (tx) => {
    // Pas de clé étrangère sur le rattachement « proche aidant » : on le détache d'abord.
    await tx.caregiverProfile.updateMany({ where: { linkedAineId: { in: ids } }, data: { linkedAineId: null } });
    await tx.aine.deleteMany({ where: { id: { in: ids } } });
    for (const r of rows) {
      await logAudit({ action: "aine.purged_without_accord", entityType: "Aine", entityId: r.id, metadata: { accordEtat: r.accordEtat } }, tx);
    }
  });
  return rows.length;
}

export type LaunchPurgeResult = { sandboxes: number; accountTokens: number; unverifiedAccounts: number; activations: number; ainesWithoutAccord: number };

export async function purgeLaunchData(launch: boolean, now: Date = new Date()): Promise<LaunchPurgeResult> {
  return {
    sandboxes: launch ? await purgeAllSandboxes() : 0,
    accountTokens: await purgeAccountTokens(now),
    unverifiedAccounts: await purgeUnverifiedAccounts(now),
    activations: await purgeActivations(now),
    ainesWithoutAccord: await purgeAinesWithoutAccord(now),
  };
}
