import type { NextRequest } from "next/server";
import { demandeVisioSchema, reponseVisioSchema } from "@/contracts/v1/verifications";
import { requestVisio } from "@/server/verifications/service";
import { json, readBody, route } from "../../../../_lib/http";
import { run, verifActor } from "../../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/identite/visio — repli humain : « Je préfère une visio ».
 * Corps : `{ creneau, raison }`. Réponse : 201 `{ demandeLe, creneau }`. L'équipe rappelle pour fixer l'heure.
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const body = await readBody(req, demandeVisioSchema);
  const r = await run(() => requestVisio(actor, body));
  return json(reponseVisioSchema.parse(r), 201);
});
