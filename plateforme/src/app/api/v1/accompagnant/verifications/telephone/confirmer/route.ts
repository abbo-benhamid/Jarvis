import type { NextRequest } from "next/server";
import { confirmationTelephoneSchema, reponseConfirmationTelephoneSchema } from "@/contracts/v1/verifications";
import { confirmPhoneCode } from "@/server/verifications/service";
import { json, readBody, route } from "../../../../_lib/http";
import { run, verifActor } from "../../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/telephone/confirmer — contrôle le code (10 minutes, 5 essais).
 * Réponse : 200 `{ etat: "VALIDE", telephoneMasque }`. Erreurs : 422 CODE_FAUX, CODE_EXPIRE, TROP_D_ESSAIS ; 404.
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const body = await readBody(req, confirmationTelephoneSchema);
  const r = await run(() => confirmPhoneCode(actor, body));
  return json(reponseConfirmationTelephoneSchema.parse(r));
});
