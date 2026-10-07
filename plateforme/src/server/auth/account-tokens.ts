import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccountTokenPurpose, Prisma } from "@prisma/client";
import { db } from "@/server/db";

/**
 * L3 : jetons à usage unique envoyés par e-mail.
 * - 256 bits aléatoires (crypto.randomBytes), préfixe lisible (« kv1_ » vérification, « kp1_ » mot de passe).
 * - En base : EMPREINTE SHA-256 seulement. Le jeton en clair existe seulement dans l'e-mail.
 * - Durées : vérification de l'e-mail 24 h, mot de passe oublié 1 h.
 * - Un nouveau jeton annule les jetons encore valides du même usage (un seul lien actif).
 * - Consommation atomique (une seule requête gagne), puis comparaison des empreintes à temps constant.
 */

export const TOKEN_TTL_MS: Record<AccountTokenPurpose, number> = {
  VERIFICATION_EMAIL: 24 * 60 * 60 * 1000,
  MOT_DE_PASSE: 60 * 60 * 1000,
};

const PREFIX: Record<AccountTokenPurpose, string> = { VERIFICATION_EMAIL: "kv1_", MOT_DE_PASSE: "kp1_" };

/** Format d'un jeton reçu (avant tout accès à la base). */
export const ACCOUNT_TOKEN_PATTERN = /^k[vp]1_[A-Za-z0-9_-]{43}$/;

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

type Client = Prisma.TransactionClient | typeof db;

/** Crée un jeton et annule les précédents du même usage. Retourne le jeton EN CLAIR (pour l'e-mail seulement). */
export async function issueAccountToken(userId: string, purpose: AccountTokenPurpose, now: Date = new Date(), client: Client = db): Promise<string> {
  const token = `${PREFIX[purpose]}${randomBytes(32).toString("base64url")}`;
  await client.accountToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } });
  await client.accountToken.create({
    data: { userId, purpose, tokenHash: hashAccountToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]), createdAt: now },
  });
  return token;
}

export type TokenCheck = { ok: true; userId: string; tokenId: string } | { ok: false };

/** Lit un jeton SANS le consommer (page « nouveau mot de passe » : afficher le formulaire ou l'erreur). */
export async function peekAccountToken(token: string, purpose: AccountTokenPurpose, now: Date = new Date()): Promise<TokenCheck> {
  if (!ACCOUNT_TOKEN_PATTERN.test(token) || !token.startsWith(PREFIX[purpose])) return { ok: false };
  const hash = hashAccountToken(token);
  const row = await db.accountToken.findUnique({ where: { tokenHash: hash } });
  if (!row || !sameHash(row.tokenHash, hash) || row.purpose !== purpose || row.usedAt || row.expiresAt <= now) return { ok: false };
  return { ok: true, userId: row.userId, tokenId: row.id };
}

/**
 * Consomme un jeton : valide, bon usage, pas expiré, pas déjà utilisé. Usage unique garanti par une mise à jour
 * conditionnelle (deux clics simultanés : un seul réussit).
 */
export async function consumeAccountToken(token: string, purpose: AccountTokenPurpose, now: Date = new Date(), client: Client = db): Promise<TokenCheck> {
  if (!ACCOUNT_TOKEN_PATTERN.test(token) || !token.startsWith(PREFIX[purpose])) return { ok: false };
  const hash = hashAccountToken(token);
  const row = await client.accountToken.findUnique({ where: { tokenHash: hash } });
  if (!row || !sameHash(row.tokenHash, hash) || row.purpose !== purpose || row.usedAt || row.expiresAt <= now) return { ok: false };
  const claimed = await client.accountToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (claimed.count !== 1) return { ok: false };
  return { ok: true, userId: row.userId, tokenId: row.id };
}

/** Purge nocturne : jetons expirés ou utilisés depuis plus d'un jour. */
export async function purgeAccountTokens(now: Date = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const r = await db.accountToken.deleteMany({ where: { OR: [{ expiresAt: { lt: limit } }, { usedAt: { lt: limit } }] } });
  return r.count;
}
