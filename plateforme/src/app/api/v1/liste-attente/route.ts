import type { NextRequest } from "next/server";
import { demandeListeAttenteSchema, type ReponseListeAttente } from "@/contracts/v1/territoires";
import { joinWaitlist } from "@/server/waitlist";
import { retryMessage } from "@/server/rate-limit-rules";
import { ApiError, ipOf, json, readBody, route } from "../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/liste-attente — public, sans jeton (T1, T2). Corps : { email, territoire, consentement: true }.
 * Réponse : 202 {} TOUJOURS (adresse déjà inscrite ou non, territoire ouvert ou non) : aucune fuite.
 * Erreurs : 400 (corps refusé, consentement absent), 429 (5 par heure et par IP).
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeListeAttenteSchema);
  const r = await joinWaitlist({ email: body.email, territoire: body.territoire, ip: ipOf(req) });
  if (!r.ok) throw new ApiError("TROP_DE_REQUETES", retryMessage(r.retryAfterSeconds), { "Retry-After": String(r.retryAfterSeconds) });
  return json<ReponseListeAttente>({}, 202);
});
