import type { NextRequest } from "next/server";
import { demandeOrientationSchema, resultatOrientationSchema, type ResultatOrientation } from "@/contracts/v1/accompagnant";
import { saveOrientationFromApp } from "@/server/accompagnant/verification-app";
import { enforceRateLimits, ipOf, json, readBody, route } from "../../_lib/http";
import { requireAccompagnant, toApiError } from "../../visites/_lib/acces";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/orientation — les 5 questions de l'orientation, depuis l'app (L1d, D15).
 * Corps : `DemandeOrientation` (clés du site : activity, paid, existingStatus, situations, familyLink), `.strict()`.
 * Réponse : 200 `ResultatOrientation`. Erreurs : 400 (corps refusé), 401, 403 (pas accompagnant),
 * 422 ACTION_IMPOSSIBLE (profil déjà validé ou suspendu : l'orientation ne se refait plus), 429.
 * Journal : `caregiver.orientation` (issue et statut, jamais les réponses).
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-accompagnant:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const body = await readBody(req, demandeOrientationSchema);
  let r: ResultatOrientation;
  try {
    r = await saveOrientationFromApp({ id: user.id, role: user.role, firstName: user.firstName }, body);
  } catch (e) {
    throw toApiError(e);
  }
  return json<ResultatOrientation>(resultatOrientationSchema.parse(r));
});
