import type { NextRequest } from "next/server";
import { demandeDeconnexionSchema } from "@/contracts/v1/auth";
import { logout } from "@/server/auth/token-service";
import { bearerToken } from "@/server/auth/token";
import { ApiError, enforceRateLimits, ipOf, noContent, readBody, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/logout — révoque la connexion de l'appareil.
 * Jeton d'accès (en-tête) et/ou jeton de renouvellement (corps). `partout: true` ferme toutes les connexions.
 * Réponse : 204, même si le jeton est déjà révoqué (idempotent ; ne révèle rien).
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeDeconnexionSchema, { allowEmpty: true });
  const accessToken = bearerToken(req.headers.get("authorization"));
  if (!accessToken && !body.jetonRenouvellement) {
    throw new ApiError("REQUETE_INVALIDE", "Envoyez le jeton d'accès ou le jeton de renouvellement.");
  }
  await enforceRateLimits([["evenement:ip", `api-v1-logout:${ipOf(req)}`]]);
  await logout({ accessToken, refreshToken: body.jetonRenouvellement, partout: body.partout });
  return noContent();
});
