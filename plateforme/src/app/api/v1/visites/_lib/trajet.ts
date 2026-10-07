import "server-only";
import { TripError } from "@/server/presence/trajet";
import { ApiError } from "../../_lib/http";

/** Erreur du service trajet (L1-B) → erreur de l'API au format unique. */
export function tripApiError(e: unknown): unknown {
  if (!(e instanceof TripError)) return e;
  switch (e.code) {
    case "INTROUVABLE":
      return new ApiError("INTROUVABLE", e.message);
    case "CONFLIT":
      return new ApiError("CONFLIT", e.message);
    case "TROP_DE_REQUETES":
      return new ApiError("TROP_DE_REQUETES", e.message, { "Retry-After": "30" });
    default:
      return new ApiError("ACTION_IMPOSSIBLE", e.message);
  }
}
