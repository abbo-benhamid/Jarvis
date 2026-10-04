/**
 * Jeton de session signé (JWT HS256 via jose). Fonctions pures : utilisables
 * dans le middleware (edge), les composants serveur et les tests.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "koudmen_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 jours

export type SessionPayload = {
  /** id de l'utilisateur */
  sub: string;
  role: Role;
  name: string;
  demo: boolean;
};

const ROLES: readonly Role[] = ["FAMILLE", "ACCOMPAGNANT", "OPERATEUR"];

export async function signSessionToken(
  payload: SessionPayload,
  secret: Uint8Array,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, demo: payload.demo })
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
    };
  } catch {
    return null;
  }
}
