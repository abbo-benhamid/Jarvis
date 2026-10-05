import type { NextRequest } from "next/server";
import { demandeAcceptationSchema, reponseAcceptationSchema, type ReponseAcceptation } from "@/contracts/v1/visits-propositions";
import { acceptProposal } from "@/server/accompagnant/service";
import { enforceRateLimits, ipOf, json, readBody, route } from "../../../_lib/http";
import { pathId, requireAccompagnant, toApiError } from "../../../visites/_lib/acces";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/propositions/:id/accepter — accepte une proposition (service du Lot B, en une transaction) :
 * mission (copie du tarif fixé par l'accompagnant) + visites des 4 semaines ; le cercle Lakou est prévenu.
 * Erreurs : 404 (inconnue ou d'un autre accompagnant), 409 CONFLIT (plus en attente), 422 ACTION_IMPOSSIBLE (profil, tarif).
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-propositions:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const id = pathId(req, 1, "Proposition introuvable.");
  await readBody(req, demandeAcceptationSchema, { allowEmpty: true });
  try {
    const r = await acceptProposal({ id: user.id, role: user.role, firstName: user.firstName }, id);
    const body: ReponseAcceptation = reponseAcceptationSchema.parse({ statut: "ACCEPTEE", missionId: r.missionId, visitesCreees: r.visitCount });
    return json(body);
  } catch (e) {
    throw toApiError(e);
  }
});
