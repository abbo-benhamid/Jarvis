import "server-only";
import type { NextRequest } from "next/server";
import { identifiantSchema } from "@/contracts/v1/visits";
import { AccompagnantError } from "@/server/accompagnant/service";
import type { AppUser } from "@/server/visits/app-service";
import { ApiError, requireBearer } from "../../_lib/http";

/**
 * Outils communs des routes métier de l'accompagnant (lot A2) : /visites, /evenements, /propositions.
 * Dossier privé `_lib` : jamais routé par Next.js.
 */

/** Jeton d'accès valide ET rôle accompagnant. Sinon : 401 NON_AUTHENTIFIE ou 403 ACCES_REFUSE. */
export async function requireAccompagnant(req: NextRequest): Promise<AppUser> {
  const { user } = await requireBearer(req);
  if (user.role !== "ACCOMPAGNANT") throw new ApiError("ACCES_REFUSE", "Cette fonction est réservée aux accompagnants.");
  return { id: user.id, role: user.role, firstName: user.firstName, sandboxId: user.sandboxId };
}

/**
 * Identifiant lu dans le chemin, `fromEnd` segments avant la fin (0 = dernier segment).
 * Forme inattendue → 404, comme un identifiant inconnu (aucune information sur l'existence).
 */
export function pathId(req: NextRequest, fromEnd: number, notFound: string): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const raw = parts[parts.length - 1 - fromEnd] ?? "";
  const parsed = identifiantSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) throw new ApiError("INTROUVABLE", notFound);
  return parsed.data;
}

/** Erreur métier du Lot B → erreur de l'API au format unique. */
export function toApiError(e: unknown): unknown {
  if (!(e instanceof AccompagnantError)) return e;
  switch (e.code) {
    case "INTROUVABLE":
      return new ApiError("INTROUVABLE", e.message);
    case "CONFLIT":
      return new ApiError("CONFLIT", e.message);
    default:
      return new ApiError("ACTION_IMPOSSIBLE", e.message);
  }
}
