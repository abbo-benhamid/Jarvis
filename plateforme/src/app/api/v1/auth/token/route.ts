import type { NextRequest } from "next/server";
import { demandeJetonSchema, type ReponseJetons } from "@/contracts/v1/auth";
import { exchangeAuthCode } from "@/server/auth/token-service";
import { ApiError, enforceRateLimits, ipOf, json, readBody, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/token — étape 2 : échange du code (usage unique) + vérificateur PKCE.
 * Réponse : { typeJeton, jetonAcces, expireDans, jetonRenouvellement, renouvellementExpireDans }.
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeJetonSchema);
  await enforceRateLimits([["login:ip", `api-v1-token:${ipOf(req)}`]]);
  const r = await exchangeAuthCode(body.code, body.codeVerifier);
  if (!r.ok) throw new ApiError(r.code, r.message);
  return json<ReponseJetons>(r.value);
});
