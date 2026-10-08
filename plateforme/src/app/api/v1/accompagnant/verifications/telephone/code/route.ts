import type { NextRequest } from "next/server";
import { demandeCodeTelephoneSchema, reponseCodeTelephoneSchema } from "@/contracts/v1/verifications";
import { sendPhoneCode } from "@/server/verifications/service";
import { json, readBody, route } from "../../../../_lib/http";
import { run, verifActor } from "../../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/telephone/code — envoie un code à 6 chiffres (SMS ou appel vocal).
 * Corps : `DemandeCodeTelephone`. Réponse : 202 `ReponseCodeTelephone` (le code n'est jamais renvoyé).
 * Erreurs : 422 PREFIXE_NON_ACCEPTE, 422 ACTION_IMPOSSIBLE (ligne fixe en SMS, appel avant 2 SMS), 409 NUMERO_DEJA_UTILISE,
 * 409 DEJA_VALIDE, 429 TROP_DE_REQUETES (60 s, 3/h et 5/jour par numéro, 10/jour par IP), 503 SERVICE_INDISPONIBLE.
 */
export const POST = route(async (req: NextRequest) => {
  const { actor, ip } = await verifActor(req);
  const body = await readBody(req, demandeCodeTelephoneSchema);
  const r = await run(() => sendPhoneCode(actor, body, ip));
  return json(reponseCodeTelephoneSchema.parse(r), 202);
});
