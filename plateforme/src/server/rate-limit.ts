import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { isStrictProduction } from "./config-check";
import { rateLimitKey, RATE_RULES, retryMessage, type RateRuleName } from "./rate-limit-rules";

export { RATE_RULES, retryMessage, type RateRuleName };

/**
 * Limites de débit (M4, M5), stockées en base : elles tiennent sur Vercel (fonctions sans mémoire partagée).
 * Fenêtre fixe par clé. Une requête SQL atomique (INSERT … ON CONFLICT … RETURNING) par essai.
 * RGPD : la clé contient une EMPREINTE de l'IP ou du compte, jamais la valeur en clair. Les lignes
 * expirées sont effacées par la purge nocturne.
 */

export type RateResult = { allowed: boolean; count: number; retryAfterSeconds: number };

/** Coupure des limites : local et CI seulement (refusée en production par config-check). */
export function rateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === "true" && !isStrictProduction();
}

/** Empreinte d'un sujet (IP, email, id de compte), salée par le secret de session. */
export function subjectHash(subject: string): string {
  const salt = process.env.SESSION_SECRET ?? "koudmen";
  return createHash("sha256").update(`${salt}:${subject.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

/** Compte un essai pour (règle, sujet). `allowed` = false au-delà de la limite. */
export async function hitRateLimit(rule: RateRuleName, subject: string, now: Date = new Date()): Promise<RateResult> {
  if (rateLimitDisabled()) return { allowed: true, count: 0, retryAfterSeconds: 0 };
  const { limit, windowSeconds } = RATE_RULES[rule];
  const key = rateLimitKey(rule, subjectHash(subject));
  const expires = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expires})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimit"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expires} ELSE "RateLimit"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  const row = rows[0]!;
  const count = Number(row.count);
  return {
    allowed: count <= limit,
    count,
    retryAfterSeconds: Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Plusieurs règles d'un coup : refusé si UNE règle est dépassée. Toutes les règles comptent l'essai. */
export async function hitRateLimits(checks: [RateRuleName, string][], now: Date = new Date()): Promise<RateResult> {
  let worst: RateResult = { allowed: true, count: 0, retryAfterSeconds: 0 };
  for (const [rule, subject] of checks) {
    const r = await hitRateLimit(rule, subject, now);
    if (!r.allowed && (worst.allowed || r.retryAfterSeconds > worst.retryAfterSeconds)) worst = r;
  }
  return worst;
}

/**
 * IP du client. Sur Vercel, `x-vercel-forwarded-for` et `x-forwarded-for` sont posés par le proxy
 * (une valeur envoyée par le client est remplacée). Hors Vercel : première valeur, sinon « inconnue ».
 */
export function clientIpFrom(h: Pick<Headers, "get">): string {
  const raw = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for") ?? "";
  const first = raw.split(",")[0]?.trim();
  return first && first.length <= 64 ? first : "inconnue";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/** Efface les compteurs expirés (purge nocturne). */
export async function purgeExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const r = await db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  return r.count;
}
