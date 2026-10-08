import type { NextRequest } from "next/server";
import { demandeVerificationSchema, etatVerificationSchema, type EtatVerification } from "@/contracts/v1/accompagnant";
import { getVerificationState, requestVerificationFromApp } from "@/server/accompagnant/verification-app";
import { enforceRateLimits, ipOf, json, readBody, route } from "../../_lib/http";
import { requireAccompagnant, toApiError } from "../../visites/_lib/acces";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/accompagnant/verification — où en est la vérification du profil (L1d, D15).
 * Réponse : 200 `EtatVerification` (étapes faites et à faire, `manque` = éléments que seul le site remplit,
 * `peutDemander`). Aucune pièce, aucune déclaration, aucune réponse brute à l'orientation.
 */
export const GET = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-accompagnant:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  return json<EtatVerification>(etatVerificationSchema.parse(await getVerificationState(user.id)));
});

/**
 * POST /api/v1/accompagnant/verification — demande la vérification du profil (mêmes contrôles que le site).
 * Corps : `{}`. Réponse : 200 `EtatVerification` (validation EN_ATTENTE). Le profil entre dans la file
 * opérateur « Accompagnants à appeler ». Erreurs : 409 CONFLIT (déjà envoyée), 422 ACTION_IMPOSSIBLE
 * (orientation non faite, profil incomplet : le message liste ce qui manque).
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-accompagnant:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  await readBody(req, demandeVerificationSchema, { allowEmpty: true });
  let etat: EtatVerification;
  try {
    etat = await requestVerificationFromApp({ id: user.id, role: user.role, firstName: user.firstName });
  } catch (e) {
    throw toApiError(e);
  }
  return json<EtatVerification>(etatVerificationSchema.parse(etat));
});
