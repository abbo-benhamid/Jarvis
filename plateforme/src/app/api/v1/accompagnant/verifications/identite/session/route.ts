import type { NextRequest } from "next/server";
import { demandeSessionIdentiteSchema, reponseSessionIdentiteSchema } from "@/contracts/v1/verifications";
import { createIdentitySession } from "@/server/verifications/service";
import { json, readBody, route } from "../../../../_lib/http";
import { run, verifActor } from "../../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/identite/session — ouvre une session chez le prestataire (lien web hébergé).
 * Corps : `{ plateforme, consentementBiometrie: true }`. Réponse : 201 `{ url, expireA, retour }`.
 * L'app ouvre `url` avec WebBrowser.openAuthSessionAsync(url, retour). Erreurs : 409 DEJA_VALIDE, 422 (revue en cours),
 * 429 (3 sessions : proposer la visio), 503 SERVICE_INDISPONIBLE (prestataire fermé : proposer la visio).
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const body = await readBody(req, demandeSessionIdentiteSchema);
  const r = await run(() => createIdentitySession(actor, body));
  return json(reponseSessionIdentiteSchema.parse(r), 201);
});
