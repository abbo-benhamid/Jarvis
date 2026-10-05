import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  sessionMaxAgeFor,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";
import { getSessionSecret } from "@/server/env";

/** Cookie du lien de reprise du bac à sable (D2). Effacé à la déconnexion (M3). */
export const RESUME_COOKIE = "koudmen_bac_a_sable";

/**
 * Crée le cookie de session httpOnly signé. À appeler dans une Server Action ou un route handler.
 * `sv` = User.sessionVersion lu en base (M7). Session opérateur : 12 heures ; autres rôles : 7 jours.
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const maxAge = sessionMaxAgeFor(payload.role);
  const token = await signSessionToken(payload, getSessionSecret(), maxAge);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, getSessionSecret());
}

/** Efface le cookie de session ET le cookie de reprise du bac à sable (M3 : appareil partagé). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(RESUME_COOKIE);
}
