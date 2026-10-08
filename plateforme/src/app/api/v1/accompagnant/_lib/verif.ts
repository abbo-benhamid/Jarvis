import "server-only";
import type { NextRequest } from "next/server";
import { VerificationError, type Actor } from "@/server/verifications/service";
import { AccompagnantError } from "@/server/accompagnant/service";
import { ApiError, enforceRateLimits, ipOf, requireBearer } from "../../_lib/http";
import { requireAccompagnant } from "../../visites/_lib/acces";

/**
 * L2 : outils communs des routes `/api/v1/accompagnant/verifications/*` et `/documents` (dossier privé `_lib`).
 */

/** Jeton valide, rôle accompagnant, garde-fou de débit commun. Renvoie l'acteur et l'IP. */
export async function verifActor(req: NextRequest): Promise<{ actor: Actor; ip: string }> {
  const ip = ipOf(req);
  await enforceRateLimits([["evenement:ip", `api-v1-verif:${ip}`]]);
  const u = await requireAccompagnant(req);
  return { actor: { id: u.id, role: u.role, firstName: u.firstName }, ip };
}

export { requireBearer };

/** Erreur métier L2 → erreur de l'API au format unique (code stable, message affichable, Retry-After). */
export function toVerifApiError(e: unknown): unknown {
  if (e instanceof VerificationError) {
    return new ApiError(e.code, e.message, e.retryAfterSeconds ? { "Retry-After": String(e.retryAfterSeconds) } : {});
  }
  if (e instanceof AccompagnantError) {
    if (e.code === "CONFLIT") return new ApiError("CONFLIT", e.message);
    if (e.code === "INTROUVABLE") return new ApiError("INTROUVABLE", e.message);
    return new ApiError("ACTION_IMPOSSIBLE", e.message);
  }
  return e;
}

/** Exécute `fn` et convertit les erreurs métier. */
export async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toVerifApiError(e);
  }
}
