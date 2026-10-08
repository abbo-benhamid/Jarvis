import type { NextRequest } from "next/server";
import { demandeAdresseSchema, reponseAdresseSchema } from "@/contracts/v1/verifications";
import { saveDeclaredAddress } from "@/server/verifications/service";
import { json, readBody, route } from "../../../_lib/http";
import { run, verifActor } from "../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/adresse — adresse déclarée (chiffrée). Auto-entrepreneur : si le siège Sirene
 * correspond, l'adresse est vérifiée sans justificatif. Réponse : 200 `{ etat, justificatifRequis }`.
 * Erreurs : 422 (statut sans adresse), 503 SERVICE_INDISPONIBLE (clé des documents absente).
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const body = await readBody(req, demandeAdresseSchema);
  const r = await run(() => saveDeclaredAddress(actor, body));
  return json(reponseAdresseSchema.parse(r));
});
