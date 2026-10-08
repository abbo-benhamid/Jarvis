import type { NextRequest } from "next/server";
import { demandeEntrepriseSchema, reponseEntrepriseSchema } from "@/contracts/v1/verifications";
import { checkCompany } from "@/server/verifications/service";
import { json, readBody, route } from "../../../_lib/http";
import { run, verifActor } from "../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/entreprise — contrôle du SIRET dans le registre (actif, nom, APE, siège).
 * Réponse : 200 `ReponseEntreprise` (`documentRequis` : Kbis, extrait RNE ou avis Sirene). Erreurs : 422 (SIRET faux,
 * absent du registre, statut sans entreprise), 409 NUMERO_DEJA_UTILISE (SIRET d'un autre compte), 409 DEJA_VALIDE.
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const body = await readBody(req, demandeEntrepriseSchema);
  const r = await run(() => checkCompany(actor, body));
  return json(reponseEntrepriseSchema.parse(r));
});
