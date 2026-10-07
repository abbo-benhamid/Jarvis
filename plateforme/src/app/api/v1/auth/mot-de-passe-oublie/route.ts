import type { NextRequest } from "next/server";
import { demandeMotDePasseOublieSchema, type ReponseMotDePasseOublie } from "@/contracts/v1/inscription";
import { requestPasswordReset } from "@/server/auth/registration";
import { hitRateLimits } from "@/server/rate-limit";
import { logAudit } from "@/server/audit";
import { ipOf, json, readBody, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/mot-de-passe-oublie — lien « nouveau mot de passe » par e-mail (L3, contrat § 2.1).
 * Réponse : 202 {} TOUJOURS (compte connu ou non, limite atteinte ou non) : aucune fuite d'existence de compte.
 * Limites : 3 par heure et par e-mail, 20 par heure et par IP. Au-delà, rien ne part, la réponse reste 202.
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeMotDePasseOublieSchema);
  const limited = await hitRateLimits([
    ["mdp-oublie:ip", ipOf(req)],
    ["mdp-oublie:compte", body.email],
  ]);
  if (limited.allowed) await requestPasswordReset(body.email);
  else await logAudit({ action: "auth.password_reset_rate_limited", entityType: "User" });
  return json<ReponseMotDePasseOublie>({}, 202);
});
