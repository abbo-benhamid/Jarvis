import type { NextRequest } from "next/server";
import { demandeCodeSchema, type ReponseCode } from "@/contracts/v1/auth";
import { requestAuthCode } from "@/server/auth/token-service";
import { logAudit } from "@/server/audit";
import { ApiError, enforceRateLimits, ipOf, json, readBody, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/code — étape 1 de la connexion de l'app.
 * Corps : { methode: "mot_de_passe", email, motDePasse, codeChallenge } ou { methode: "demo", role, codeChallenge }.
 * Réponse : { code, expireDans }. Limites : mêmes compteurs que la connexion web (par IP et par compte).
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeCodeSchema);
  const ip = ipOf(req);
  try {
    await enforceRateLimits(body.methode === "mot_de_passe" ? [["login:ip", ip], ["login:compte", body.email]] : [["login:ip", ip]]);
  } catch (e) {
    if (e instanceof ApiError) await logAudit({ action: "auth.api.login_rate_limited", entityType: "User" });
    throw e;
  }
  const r = await requestAuthCode(body);
  if (!r.ok) throw new ApiError(r.code, r.message);
  return json<ReponseCode>(r.value);
});
