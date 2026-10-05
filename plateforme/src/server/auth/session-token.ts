/**
 * Jeton de session signé (JWT HS256 via jose). Fonctions pures : utilisables
 * dans le middleware (edge), les composants serveur et les tests.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "koudmen_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 jours
/** M7 : session opérateur courte (12 heures). */
export const OPERATOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function sessionMaxAgeFor(role: Role): number {
  return role === "OPERATEUR" ? OPERATOR_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
}

export type SessionPayload = {
  /** id de l'utilisateur */
  sub: string;
  role: Role;
  name: string;
  demo: boolean;
  /** Version de session (M7) : doit être égale à User.sessionVersion. -1 = jeton ancien (refusé). */
  sv: number;
};

const ROLES: readonly Role[] = ["FAMILLE", "ACCOMPAGNANT", "OPERATEUR"];

export async function signSessionToken(
  payload: SessionPayload,
  secret: Uint8Array,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, demo: payload.demo, sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("koudmen")
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret);
}

/** Retourne la session, ou null si le jeton est absent, invalide ou expiré. */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: Uint8Array,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: "koudmen", algorithms: ["HS256"] });
    const role = payload.role as Role;
    if (!payload.sub || !ROLES.includes(role)) return null;
    return {
      sub: payload.sub,
      role,
      name: typeof payload.name === "string" ? payload.name : "",
      demo: payload.demo === true,
      sv: typeof payload.sv === "number" && Number.isInteger(payload.sv) ? payload.sv : -1,
    };
  } catch {
    return null;
  }
}
