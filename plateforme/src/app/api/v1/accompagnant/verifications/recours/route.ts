import type { NextRequest } from "next/server";
import { demandeRecoursSchema, reponseRecoursSchema } from "@/contracts/v1/verifications";
import { createAppeal } from "@/server/verifications/service";
import { json, readBody, route } from "../../../_lib/http";
import { run, verifActor } from "../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/recours — demande de réexamen après un refus (30 jours).
 * Un AUTRE opérateur traite la demande sous 7 jours. Réponse : 201 `{ recoursId, etat: "EN_ATTENTE" }`.
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const body = await readBody(req, demandeRecoursSchema);
  const r = await run(() => createAppeal(actor, body.motifRecours));
  return json(reponseRecoursSchema.parse(r), 201);
});
