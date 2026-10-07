import type { NextRequest } from "next/server";
import { demandeTrajetSchema, reponseTrajetSchema, type ReponseTrajet } from "@/contracts/v1/trajet";
import { startOrStopTrip } from "@/server/presence/trajet";
import { enforceRateLimits, ipOf, json, readBody, route } from "../../../_lib/http";
import { pathId, requireAccompagnant } from "../../_lib/acces";
import { tripApiError } from "../../_lib/trajet";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/visites/:id/trajet — l'accompagnant démarre (DEMARRER) ou arrête (ARRETER) le partage de son trajet.
 * L6, R4 : démarrage par l'accompagnant lui-même, de 2 h avant le début à la fin prévue, avant le check-in.
 * Fin automatique : check-in, 60 min, arrivée à moins de 150 m du domicile. Idempotent.
 * Erreurs : 404 (visite inconnue ou d'un autre accompagnant), 409 (check-in déjà fait), 422 (hors fenêtre, profil, accord).
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-trajet:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const id = pathId(req, 1, "Visite introuvable.");
  const { action } = await readBody(req, demandeTrajetSchema);
  try {
    const body: ReponseTrajet = reponseTrajetSchema.parse(await startOrStopTrip(user, id, action));
    return json(body);
  } catch (e) {
    throw tripApiError(e);
  }
});
