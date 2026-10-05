import type { NextRequest } from "next/server";
import { reponseVisiteSchema, type ReponseVisite } from "@/contracts/v1/visits";
import { getAppVisit } from "@/server/visits/app-service";
import { ApiError, enforceRateLimits, ipOf, json, route } from "../../_lib/http";
import { pathId, requireAccompagnant } from "../_lib/acces";

export const dynamic = "force-dynamic";

const NOT_FOUND = "Visite introuvable.";

/**
 * GET /api/v1/visites/:id — une visite de l'accompagnant connecté, avec le brouillon de Kayé synchronisé.
 * La visite d'un autre accompagnant répond 404, comme une visite inexistante (pas d'IDOR, rien n'est révélé).
 */
export const GET = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-visites:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const id = pathId(req, 0, NOT_FOUND);
  const visite = await getAppVisit(user.id, id);
  if (!visite) throw new ApiError("INTROUVABLE", NOT_FOUND);
  const body: ReponseVisite = reponseVisiteSchema.parse(visite);
  return json(body);
});
