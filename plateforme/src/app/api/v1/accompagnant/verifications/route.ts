import type { NextRequest } from "next/server";
import { dossierVerificationSchema } from "@/contracts/v1/verifications";
import { getDossier } from "@/server/verifications/service";
import { json, route } from "../../_lib/http";
import { run, verifActor } from "../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/accompagnant/verifications — dossier de vérification (L2) : état du dossier, éléments, action suivante,
 * ce qui manque, sessions d'identité restantes. Réponse : 200 `DossierVerification`. Aucune pièce, aucune image,
 * aucune adresse ni date de naissance.
 */
export const GET = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  return json(dossierVerificationSchema.parse(await run(() => getDossier(actor.id))));
});
