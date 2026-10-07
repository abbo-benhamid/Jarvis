import type { NextRequest } from "next/server";
import { demandePositionSchema } from "@/contracts/v1/trajet";
import { recordTripPosition } from "@/server/presence/trajet";
import { enforceRateLimits, ipOf, noContent, readBody, route } from "../../../_lib/http";
import { pathId, requireAccompagnant } from "../../_lib/acces";
import { tripApiError } from "../../_lib/trajet";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/visites/:id/position — dernière position pendant un trajet démarré (L6, R4).
 * 204 ; 409 CONFLIT sans trajet en cours (jamais de position hors trajet) ; 429 si moins de 30 s depuis la précédente.
 * Coordonnées arrondies à 3 décimales avant l'écriture ; aucun historique ; jamais de coordonnées dans un journal.
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-position:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const id = pathId(req, 1, "Visite introuvable.");
  const body = await readBody(req, demandePositionSchema);
  try {
    await recordTripPosition(user, id, body);
  } catch (e) {
    throw tripApiError(e);
  }
  return noContent();
});
