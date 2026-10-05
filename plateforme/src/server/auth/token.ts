/**
 * Jetons de l'API v1 (app mobile, ADR 0008 § 4.5). Fonctions PURES : pas de base, pas de `server-only`,
 * testables seules. La logique avec la base est dans `token-service.ts`.
 *
 * - Clés DÉRIVÉES de SESSION_SECRET (HKDF-SHA256), une par usage : un cookie de session web n'est
 *   jamais accepté comme jeton d'accès, et un code de connexion n'est jamais accepté comme jeton d'accès.
 * - Jeton d'accès : JWT HS256, 15 min, lié à User.sessionVersion (`sv`) et à la famille de jetons (`fid`).
 * - Code de connexion : JWT HS256, 2 min, lié au défi PKCE (S256), usage unique (contrôlé en base).
 * - Jeton de renouvellement : 256 bits aléatoires, opaques. Seule l'empreinte SHA-256 va en base.
 */
import { createHash, hkdfSync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { DUREE_CODE_S, DUREE_JETON_ACCES_S } from "@/contracts/v1/auth";

export const TOKEN_ISSUER = "koudmen";
export const ACCESS_AUDIENCE = "koudmen:api:v1";
export const CODE_AUDIENCE = "koudmen:api:v1:code";
/** Préfixe des jetons de renouvellement (repérage dans un journal ou un scanner de secrets). */
export const REFRESH_PREFIX = "kr1_";

export type KeyUsage = "acces" | "code";

/** Clé HS256 dérivée du secret de session, propre à un usage. */
export function deriveKey(secret: Uint8Array, usage: KeyUsage): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", secret, "koudmen-api-v1", `koudmen/api-v1/${usage}`, 32));
}

const ROLES: readonly Role[] = ["FAMILLE", "ACCOMPAGNANT", "OPERATEUR"];

// ─────────────── Jeton d'accès ───────────────

export type AccessClaims = {
  /** id de l'utilisateur */
  sub: string;
  role: Role;
  /** User.sessionVersion à l'émission. */
  sv: number;
  /** Famille de jetons de renouvellement (= une connexion d'appareil). */
  fid: string;
};

export async function signAccessToken(claims: AccessClaims, key: Uint8Array, now: Date = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: claims.role, sv: claims.sv, fid: claims.fid })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(claims.sub)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + DUREE_JETON_ACCES_S)
    .setJti(randomUUID())
    .sign(key);
}

/** Retourne les données du jeton, ou null s'il est absent, falsifié, expiré ou d'un autre usage. */
export async function verifyAccessToken(token: string | null | undefined, key: Uint8Array, now: Date = new Date()): Promise<AccessClaims | null> {
  if (!token || token.length > 2000) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      issuer: TOKEN_ISSUER,
      audience: ACCESS_AUDIENCE,
      algorithms: ["HS256"],
      currentDate: now,
    });
    if (protectedHeader.typ !== "at+jwt") return null;
    const role = payload.role as Role;
    if (!payload.sub || !ROLES.includes(role)) return null;
    if (typeof payload.sv !== "number" || !Number.isInteger(payload.sv)) return null;
    if (typeof payload.fid !== "string" || payload.fid.length === 0) return null;
    return { sub: payload.sub, role, sv: payload.sv, fid: payload.fid };
  } catch {
    return null;
  }
}

/** Jeton de l'en-tête `Authorization: Bearer …`, ou null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header.trim());
  return m ? m[1]! : null;
}

// ─────────────── Code de connexion (PKCE) ───────────────

export type AuthCodeClaims = {
  sub: string;
  sv: number;
  /** Défi PKCE S256. */
  cc: string;
  /** Identifiant unique du code (usage unique contrôlé par RefreshToken.authCodeId). */
  jti: string;
};

export async function signAuthCode(claims: Omit<AuthCodeClaims, "jti">, key: Uint8Array, now: Date = new Date()): Promise<{ code: string; jti: string }> {
  const iat = Math.floor(now.getTime() / 1000);
  const jti = randomUUID();
  const code = await new SignJWT({ sv: claims.sv, cc: claims.cc })
    .setProtectedHeader({ alg: "HS256", typ: "code+jwt" })
    .setSubject(claims.sub)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(CODE_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + DUREE_CODE_S)
    .setJti(jti)
    .sign(key);
  return { code, jti };
}

export async function verifyAuthCode(code: string, key: Uint8Array, now: Date = new Date()): Promise<AuthCodeClaims | null> {
  try {
    const { payload, protectedHeader } = await jwtVerify(code, key, {
      issuer: TOKEN_ISSUER,
      audience: CODE_AUDIENCE,
      algorithms: ["HS256"],
      currentDate: now,
    });
    if (protectedHeader.typ !== "code+jwt") return null;
    if (!payload.sub || !payload.jti || typeof payload.cc !== "string") return null;
    if (typeof payload.sv !== "number" || !Number.isInteger(payload.sv)) return null;
    return { sub: payload.sub, sv: payload.sv, cc: payload.cc, jti: payload.jti };
  } catch {
    return null;
  }
}

/** Défi PKCE S256 : base64url(SHA-256(vérificateur)). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** Compare le vérificateur au défi, en temps constant. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  const a = Buffer.from(pkceChallenge(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─────────────── Jeton de renouvellement ───────────────

/** Nouveau jeton de renouvellement opaque (256 bits). */
export function generateRefreshToken(): string {
  return `${REFRESH_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Empreinte stockée en base (jamais le jeton en clair). */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
