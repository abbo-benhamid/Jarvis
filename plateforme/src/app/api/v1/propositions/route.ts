import type { NextRequest } from "next/server";
import { reponsePropositionsSchema, type ReponsePropositions } from "@/contracts/v1/visits-propositions";
import { listAppProposals } from "@/server/visits/app-service";
import { enforceRateLimits, ipOf, json, route } from "../_lib/http";
import { requireAccompagnant } from "../visites/_lib/acces";

export const dynamic = "force-dynamic";

/** GET /api/v1/propositions — propositions de mission en attente de réponse de l'accompagnant connecté. */
export const GET = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-propositions:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const body: ReponsePropositions = reponsePropositionsSchema.parse({ propositions: await listAppProposals(user.id) });
  return json(body);
});
