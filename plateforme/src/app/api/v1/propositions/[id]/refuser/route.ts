import type { NextRequest } from "next/server";
import { demandeRefusSchema, reponseRefusSchema, type ReponseRefus } from "@/contracts/v1/visits-propositions";
import { declineProposal } from "@/server/accompagnant/service";
import { enforceRateLimits, ipOf, json, readBody, route } from "../../../_lib/http";
import { pathId, requireAccompagnant, toApiError } from "../../../visites/_lib/acces";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/propositions/:id/refuser — refuse une proposition, SANS PÉNALITÉ (RM-05, anti-requalification) :
 * aucun compteur, aucune baisse de visibilité. La note est facultative et n'est jamais transmise à la famille.
 * Possible même pour un profil suspendu. Erreurs : 404, 409 CONFLIT (plus en attente).
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-propositions:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const id = pathId(req, 1, "Proposition introuvable.");
  const { note } = await readBody(req, demandeRefusSchema, { allowEmpty: true });
  try {
    await declineProposal({ id: user.id, role: user.role, firstName: user.firstName }, id, note ? note : null);
  } catch (e) {
    throw toApiError(e);
  }
  const body: ReponseRefus = reponseRefusSchema.parse({ statut: "REFUSEE", sansPenalite: true });
  return json(body);
});
