import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/server/db";
import { getSessionSecret, isDemoMode } from "@/server/env";
import { logAudit } from "@/server/audit";
import { DEMO_ACCOUNTS, type DemoRole } from "./demo";
import { verifyPassword, verifyPasswordForUnknownAccount } from "./password";
import {
  deriveKey,
  generateRefreshToken,
  hashRefreshToken,
  pkceMatches,
  signAccessToken,
  signAuthCode,
  verifyAccessToken,
  verifyAuthCode,
} from "./token";
import {
  DUREE_CODE_S,
  DUREE_JETON_ACCES_S,
  DUREE_JETON_RENOUVELLEMENT_S,
  type ReponseCode,
  type ReponseJetons,
} from "@/contracts/v1/auth";
import type { CodeErreur } from "@/contracts/v1/erreurs";

/**
 * Service des jetons de l'API v1 (ADR 0008 § 4.5, spécification V1 § 4.4).
 * Règles :
 * - Mêmes refus que la connexion web : compte démo hors mode démo (D1), compte de bac à sable
 *   par mot de passe (D2, il s'ouvre par son lien de reprise).
 * - Opérateur : refusé sur l'API (TOTP obligatoire en V1, web seulement).
 * - Rotation à chaque renouvellement ; un jeton déjà utilisé → toute la famille est révoquée.
 * - Tout jeton est lié à User.sessionVersion : la déconnexion web (M7) coupe aussi l'app.
 * - Audit sans e-mail ni jeton en clair.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; code: CodeErreur; message: string };

const fail = <T>(code: CodeErreur, message: string): Result<T> => ({ ok: false, code, message });

export const REVOCATION = {
  DECONNEXION: "DECONNEXION",
  DECONNEXION_PARTOUT: "DECONNEXION_PARTOUT",
  REUTILISATION: "REUTILISATION",
  CODE_REUTILISE: "CODE_REUTILISE",
  VERSION_SESSION: "VERSION_SESSION",
  ACCES_REFUSE: "ACCES_REFUSE",
  /** X1 : successeur remplacé pendant le délai de grâce (réponse de /auth/refresh perdue). */
  GRACE_REMPLACE: "GRACE_REMPLACE",
} as const;

/** Champs du compte lus par l'API (jamais le hash du mot de passe, sauf à la connexion). */
const userSelect = {
  id: true,
  role: true,
  email: true,
  firstName: true,
  lastName: true,
  isDemo: true,
  sandboxId: true,
  sessionVersion: true,
} satisfies Prisma.UserSelect;

export type ApiUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/** Raison du refus d'un compte sur l'API, ou null s'il est accepté. */
export function apiAccessProblem(user: Pick<ApiUser, "role" | "isDemo">, demoMode: boolean = isDemoMode()): string | null {
  if (user.role === "OPERATEUR") return "L'espace opérateur s'ouvre seulement sur le site web.";
  if (user.isDemo && !demoMode) return "Les comptes de démonstration sont désactivés sur cette version.";
  return null;
}

function keys() {
  const secret = getSessionSecret();
  return { acces: deriveKey(secret, "acces"), code: deriveKey(secret, "code") };
}

// ─────────────── POST /auth/code ───────────────

export type CodeRequest =
  | { methode: "mot_de_passe"; email: string; motDePasse: string; codeChallenge: string }
  | { methode: "demo"; role: DemoRole; codeChallenge: string };

const BAD_CREDENTIALS = "E-mail ou mot de passe incorrect.";

/** Vérifie l'identité et émet un code de connexion à usage unique (2 min), lié au défi PKCE. */
export async function requestAuthCode(req: CodeRequest, now: Date = new Date()): Promise<Result<ReponseCode>> {
  let user: ApiUser | null;
  if (req.methode === "demo") {
    if (!isDemoMode()) return fail("ACCES_REFUSE", "Le mode démonstration est désactivé sur cette version.");
    user = await db.user.findUnique({ where: { email: DEMO_ACCOUNTS[req.role].email }, select: userSelect });
    if (!user || !user.isDemo || user.role !== req.role) return fail("INTROUVABLE", "Le compte de démonstration n'existe pas sur cette version.");
  } else {
    const found = await db.user.findUnique({ where: { email: req.email }, select: { ...userSelect, passwordHash: true } });
    // Message identique dans les deux cas : on ne révèle pas si le compte existe.
    const valid = found ? await verifyPassword(req.motDePasse, found.passwordHash) : await verifyPasswordForUnknownAccount(req.motDePasse);
    if (!found || !valid) {
      await logAudit({ action: "auth.api.login_failed", entityType: "User", entityId: found?.id ?? null });
      return fail("IDENTIFIANTS_INVALIDES", BAD_CREDENTIALS);
    }
    const { passwordHash: _ph, ...safe } = found;
    user = safe;
    // D2 : un compte de bac à sable s'ouvre seulement par son lien de reprise.
    if (user.sandboxId) return fail("ACCES_REFUSE", "Ce compte de test s'ouvre avec votre lien de reprise.");
  }
  const problem = apiAccessProblem(user);
  if (problem) return fail("ACCES_REFUSE", problem);

  const { code } = await signAuthCode({ sub: user.id, sv: user.sessionVersion, cc: req.codeChallenge }, keys().code, now);
  await logAudit({
    actor: { id: user.id, role: user.role },
    action: req.methode === "demo" ? "auth.api.demo_login" : "auth.api.login",
    entityType: "User",
    entityId: user.id,
  });
  return { ok: true, value: { code, expireDans: DUREE_CODE_S } };
}

// ─────────────── Émission des jetons ───────────────

async function issueTokens(
  user: Pick<ApiUser, "id" | "role" | "sessionVersion">,
  familyId: string,
  extra: { authCodeId?: string; parentId?: string },
  client: Prisma.TransactionClient | typeof db,
  now: Date,
): Promise<ReponseJetons> {
  const refresh = generateRefreshToken();
  await client.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refresh),
      authCodeId: extra.authCodeId ?? null,
      parentId: extra.parentId ?? null,
      sessionVersion: user.sessionVersion,
      expiresAt: new Date(now.getTime() + DUREE_JETON_RENOUVELLEMENT_S * 1000),
      createdAt: now,
    },
  });
  const jetonAcces = await signAccessToken({ sub: user.id, role: user.role, sv: user.sessionVersion, fid: familyId }, keys().acces, now);
  return {
    typeJeton: "Bearer",
    jetonAcces,
    expireDans: DUREE_JETON_ACCES_S,
    jetonRenouvellement: refresh,
    renouvellementExpireDans: DUREE_JETON_RENOUVELLEMENT_S,
  };
}

/** Révoque toutes les lignes encore actives d'une famille. */
export async function revokeFamily(familyId: string, reason: string, now: Date = new Date()): Promise<number> {
  const r = await db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now, revokedReason: reason } });
  return r.count;
}

// ─────────────── POST /auth/token ───────────────

const BAD_CODE = "Ce code de connexion n'est plus valide. Connectez-vous de nouveau.";

/** Échange un code de connexion (usage unique) et son vérificateur PKCE contre un couple de jetons. */
export async function exchangeAuthCode(code: string, codeVerifier: string, now: Date = new Date()): Promise<Result<ReponseJetons>> {
  const claims = await verifyAuthCode(code, keys().code, now);
  if (!claims || !pkceMatches(codeVerifier, claims.cc)) return fail("CODE_INVALIDE", BAD_CODE);
  const user = await db.user.findUnique({ where: { id: claims.sub }, select: userSelect });
  if (!user || user.sessionVersion !== claims.sv) return fail("CODE_INVALIDE", BAD_CODE);
  const problem = apiAccessProblem(user);
  if (problem) return fail("ACCES_REFUSE", problem);

  // Code déjà échangé : il a peut-être été intercepté. On révoque la connexion qu'il a ouverte (RFC 6749 § 4.1.2).
  const codeReused = async (): Promise<Result<ReponseJetons>> => {
    const first = await db.refreshToken.findUnique({ where: { authCodeId: claims.jti }, select: { familyId: true } });
    if (first) await revokeFamily(first.familyId, REVOCATION.CODE_REUTILISE, now);
    await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.api.code_reuse", entityType: "User", entityId: user.id });
    return fail("CODE_INVALIDE", BAD_CODE);
  };
  if (await db.refreshToken.findUnique({ where: { authCodeId: claims.jti }, select: { id: true } })) return codeReused();

  const familyId = randomUUID();
  try {
    const tokens = await issueTokens(user, familyId, { authCodeId: claims.jti }, db, now);
    // Sécurité m9 : la connexion est faite à l'échange du code (PKCE), pas à l'émission du code.
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.api.token", entityType: "User", entityId: user.id, metadata: { famille: familyId } });
    return { ok: true, value: tokens };
  } catch (e) {
    // Deux échanges simultanés du même code : la contrainte unique (authCodeId) départage.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return codeReused();
    throw e;
  }
}

// ─────────────── POST /auth/refresh ───────────────

const BAD_REFRESH = "Votre connexion a expiré. Connectez-vous de nouveau.";
const REUSED_REFRESH = "Votre connexion a été fermée par sécurité. Connectez-vous de nouveau.";

/**
 * Rotation : le jeton présenté est marqué « utilisé » et un nouveau couple est émis dans la même famille.
 * Un jeton déjà utilisé (rejoué, volé, ou deux renouvellements simultanés) révoque toute la famille.
 */
export async function rotateRefreshToken(raw: string, now: Date = new Date()): Promise<Result<ReponseJetons>> {
  const row = await db.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(raw) },
    select: { id: true, familyId: true, usedAt: true, revokedAt: true, revokedReason: true, expiresAt: true, sessionVersion: true, user: { select: userSelect } },
  });
  if (!row) return fail("JETON_INVALIDE", BAD_REFRESH);
  const user = row.user;

  if (row.usedAt) {
    // X1 : réponse de /auth/refresh perdue (réseau faible) → l'app rejoue l'ancien jeton peu après.
    const grace = await graceRotation(row, user, now);
    return grace ?? reuseDetected(row.familyId, user, now);
  }
  // X1 : un jeton remplacé pendant le délai de grâce qui revient quand même = deux détenteurs : rejeu.
  if (row.revokedReason === REVOCATION.GRACE_REMPLACE) return reuseDetected(row.familyId, user, now);
  if (row.revokedAt || row.expiresAt <= now) return fail("JETON_INVALIDE", BAD_REFRESH);
  if (user.sessionVersion !== row.sessionVersion) {
    await revokeFamily(row.familyId, REVOCATION.VERSION_SESSION, now);
    return fail("JETON_INVALIDE", BAD_REFRESH);
  }
  const problem = apiAccessProblem(user);
  if (problem) {
    await revokeFamily(row.familyId, REVOCATION.ACCES_REFUSE, now);
    return fail("ACCES_REFUSE", problem);
  }

  const tokens = await db.$transaction(async (tx) => {
    // Marquage atomique : une seule requête concurrente gagne.
    const claimed = await tx.refreshToken.updateMany({ where: { id: row.id, usedAt: null, revokedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return null;
    return issueTokens(user, row.familyId, { parentId: row.id }, tx, now);
  });
  if (!tokens) return reuseDetected(row.familyId, user, now);
  return { ok: true, value: tokens };
}

/** X1 : délai de grâce après une rotation. */
export const DELAI_GRACE_ROTATION_MS = 30_000;

/**
 * X1 (arbitrage V1) : délai de grâce de 30 s à la rotation.
 * Cas visé : la réponse de /auth/refresh est perdue ; l'app rejoue le jeton qu'elle a encore.
 * Conditions (toutes) : le jeton présenté a servi il y a moins de 30 s, il n'est pas révoqué, la famille
 * est ouverte, et son SUCCESSEUR n'a jamais servi (l'app ne l'a donc jamais reçu ou jamais utilisé).
 * Effet : le successeur est révoqué (GRACE_REMPLACE) et un nouveau couple est émis dans la même famille.
 * Le jeton présenté prouve la possession (même appareil) ; tout autre rejeu révoque la famille.
 * [À VÉRIFIER] risque résiduel : un voleur du jeton dans les 30 s obtient un couple ; l'app légitime
 * est alors déconnectée au renouvellement suivant (rejeu détecté), comme sans délai de grâce.
 */
async function graceRotation(
  row: { id: string; familyId: string; usedAt: Date | null; revokedAt: Date | null; expiresAt: Date; sessionVersion: number },
  user: ApiUser,
  now: Date,
): Promise<Result<ReponseJetons> | null> {
  if (!row.usedAt || row.revokedAt || now.getTime() - row.usedAt.getTime() > DELAI_GRACE_ROTATION_MS) return null;
  if (user.sessionVersion !== row.sessionVersion || apiAccessProblem(user)) return null;
  const tokens = await db.$transaction(async (tx) => {
    // Le successeur doit être intact (ni utilisé, ni révoqué). Marquage atomique : une seule requête gagne.
    const child = await tx.refreshToken.updateMany({
      where: { parentId: row.id, familyId: row.familyId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now, revokedReason: REVOCATION.GRACE_REMPLACE },
    });
    if (child.count !== 1) return null;
    return issueTokens(user, row.familyId, { parentId: row.id }, tx, now);
  });
  if (!tokens) return null;
  await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.api.refresh_grace", entityType: "User", entityId: user.id, metadata: { famille: row.familyId } });
  return { ok: true, value: tokens };
}

async function reuseDetected(familyId: string, user: Pick<ApiUser, "id" | "role">, now: Date): Promise<Result<ReponseJetons>> {
  await revokeFamily(familyId, REVOCATION.REUTILISATION, now);
  await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.api.refresh_reuse", entityType: "User", entityId: user.id, metadata: { famille: familyId } });
  return fail("JETON_REUTILISE", REUSED_REFRESH);
}

// ─────────────── Jeton d'accès (routes protégées) ───────────────

export type ApiPrincipal = { user: ApiUser; familyId: string };

/**
 * Authentifie un jeton d'accès. Refusé si : signature ou durée invalide, compte absent, version de session
 * différente (déconnexion web), compte refusé sur l'API, ou connexion (famille) révoquée.
 */
export async function authenticateAccessToken(token: string | null, now: Date = new Date()): Promise<ApiPrincipal | null> {
  const claims = await verifyAccessToken(token, keys().acces, now);
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.sub }, select: userSelect });
  if (!user || user.sessionVersion !== claims.sv || user.role !== claims.role) return null;
  if (apiAccessProblem(user)) return null;
  const active = await db.refreshToken.count({ where: { familyId: claims.fid, userId: user.id, revokedAt: null } });
  if (active === 0) return null;
  return { user, familyId: claims.fid };
}

// ─────────────── POST /auth/logout ───────────────

/**
 * Déconnexion de l'appareil : révoque la famille du jeton de renouvellement et/ou du jeton d'accès.
 * `partout` : incrémente aussi User.sessionVersion (toutes les connexions, web comprises).
 * X6 : `partout` est ignoré pour un compte démo partagé.
 * Retourne false si aucun jeton n'identifie un compte (la route répond quand même 204).
 */
export async function logout(input: { accessToken: string | null; refreshToken?: string; partout?: boolean }, now: Date = new Date()): Promise<boolean> {
  const families = new Map<string, { id: string; role: Role; isDemo: boolean }>();
  const principal = input.accessToken ? await authenticateAccessToken(input.accessToken, now) : null;
  if (principal) families.set(principal.familyId, { id: principal.user.id, role: principal.user.role, isDemo: principal.user.isDemo });
  if (input.refreshToken) {
    const row = await db.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(input.refreshToken) },
      select: { familyId: true, user: { select: { id: true, role: true, isDemo: true } } },
    });
    if (row) families.set(row.familyId, row.user);
  }
  if (families.size === 0) return false;
  // X6 (sécurité D1) : compte démo PARTAGÉ → « partout » refusé (un visiteur ne coupe pas les autres).
  // Seule la connexion de cet appareil est fermée.
  const demo = [...families.values()].some((u) => u.isDemo);
  const partout = Boolean(input.partout) && !demo;
  for (const [familyId, user] of families) {
    await revokeFamily(familyId, partout ? REVOCATION.DECONNEXION_PARTOUT : REVOCATION.DECONNEXION, now);
    await logAudit({
      actor: { id: user.id, role: user.role },
      action: "auth.api.logout",
      entityType: "User",
      entityId: user.id,
      metadata: { famille: familyId, partout, ...(input.partout && demo ? { partoutRefuseDemo: true } : {}) },
    });
  }
  if (partout) {
    const userIds = [...new Set([...families.values()].map((u) => u.id))];
    await db.user.updateMany({ where: { id: { in: userIds } }, data: { sessionVersion: { increment: 1 } } });
    await db.refreshToken.updateMany({ where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: now, revokedReason: REVOCATION.DECONNEXION_PARTOUT } });
  }
  return true;
}

// ─────────────── Purge ───────────────

/**
 * Efface les jetons expirés ou révoqués depuis plus de `keepDays` jours (traces de détection de réutilisation).
 * Appelée par la purge nocturne (V1c, X9 : src/server/app-retention.ts).
 */
export async function purgeRefreshTokens(now: Date = new Date(), keepDays = 7): Promise<number> {
  const limit = new Date(now.getTime() - keepDays * 86_400_000);
  const r = await db.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: limit } }, { revokedAt: { lt: limit } }] } });
  return r.count;
}
