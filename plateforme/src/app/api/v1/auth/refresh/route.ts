import type { NextRequest } from "next/server";
import { demandeRenouvellementSchema, type ReponseJetons } from "@/contracts/v1/auth";
import { rotateRefreshToken } from "@/server/auth/token-service";
import { ApiError, enforceRateLimits, ipOf, json, readBody, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/refresh — rotation du jeton de renouvellement.
 * Un jeton déjà utilisé → 401 JETON_REUTILISE et toute la connexion de l'appareil est révoquée.
 * Limite large par IP (compteur séparé) : beaucoup d'abonnés mobiles partagent une IP (CGNAT).
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeRenouvellementSchema);
  await enforceRateLimits([["evenement:ip", `api-v1-refresh:${ipOf(req)}`]]);
  const r = await rotateRefreshToken(body.jetonRenouvellement);
  if (!r.ok) throw new ApiError(r.code, r.message);
  return json<ReponseJetons>(r.value);
});
