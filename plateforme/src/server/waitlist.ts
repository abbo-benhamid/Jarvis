import "server-only";
import type { PrismaClient, Territoire } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { hitRateLimits } from "@/server/rate-limit";
import { isOuvert } from "@/lib/territoires";
import {
  LISTE_ATTENTE_CONSENTEMENT_TEXTE,
  LISTE_ATTENTE_CONSENTEMENT_VERSION,
  LISTE_ATTENTE_CONSERVATION_MOIS,
} from "@/contracts/v1/territoires";

/**
 * T1 (T2) : liste d'attente des territoires « Bientôt ». Partagé par le site web et l'API v1.
 * RÈGLES :
 * - Consentement explicite (case non cochée par défaut) : texte exact et version gardés.
 * - Aucune fuite : même résultat si l'adresse est déjà inscrite, si le territoire est ouvert ou si la limite par e-mail
 *   est atteinte. Seule la limite par IP répond « trop d'essais » (elle ne dit rien d'une adresse).
 * - Journal sans e-mail : territoire seulement.
 * - Purge après 12 mois (purge nocturne).
 */

export type WaitlistResult = { ok: true } | { ok: false; reason: "TROP_DE_REQUETES"; retryAfterSeconds: number };

export async function joinWaitlist(input: { email: string; territoire: Territoire; ip: string }, now: Date = new Date()): Promise<WaitlistResult> {
  const ipLimit = await hitRateLimits([["liste-attente:ip", input.ip]], now);
  if (!ipLimit.allowed) return { ok: false, reason: "TROP_DE_REQUETES", retryAfterSeconds: ipLimit.retryAfterSeconds };
  const email = input.email.trim().toLowerCase();
  const perEmail = await hitRateLimits([["liste-attente:email", email]], now);
  // Territoire ouvert : rien à garder (la personne peut créer un compte). Limite par e-mail : rien n'est fait.
  if (!perEmail.allowed || isOuvert(input.territoire)) return { ok: true };
  const r = await db.waitlistEntry.createMany({
    data: [
      {
        email,
        territoire: input.territoire,
        consentText: LISTE_ATTENTE_CONSENTEMENT_TEXTE,
        consentVersion: LISTE_ATTENTE_CONSENTEMENT_VERSION,
        consentAt: now,
      },
    ],
    skipDuplicates: true,
  });
  if (r.count > 0) await logAudit({ action: "waitlist.joined", entityType: "WaitlistEntry", metadata: { territoire: input.territoire } });
  return { ok: true };
}

/** Inscriptions de plus de 12 mois : effacées. Renvoie le nombre de lignes effacées. */
export async function purgeWaitlist(now: Date = new Date(), client: PrismaClient = db): Promise<number> {
  const limit = new Date(now);
  limit.setUTCMonth(limit.getUTCMonth() - LISTE_ATTENTE_CONSERVATION_MOIS);
  const r = await client.waitlistEntry.deleteMany({ where: { createdAt: { lt: limit } } });
  return r.count;
}
