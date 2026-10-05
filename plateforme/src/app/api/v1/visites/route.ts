import type { NextRequest } from "next/server";
import { reponseVisitesSchema, requeteVisitesSchema, type ReponseVisites } from "@/contracts/v1/visits";
import { listAppVisits } from "@/server/visits/app-service";
import { ApiError, enforceRateLimits, ipOf, json, route } from "../_lib/http";
import { requireAccompagnant } from "./_lib/acces";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/visites?jours=7 — visites de l'accompagnant connecté (de 12 h avant maintenant à `jours` jours après).
 * Sert au cache hors ligne de l'app. RGPD : liste fermée de champs (contrat), jamais le code du domicile.
 */
export const GET = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-visites:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const query = requeteVisitesSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) throw new ApiError("REQUETE_INVALIDE", "Paramètre refusé : jours (entier de 1 à 14).");
  const now = new Date();
  const visites = await listAppVisits(user.id, query.data.jours, now);
  const body: ReponseVisites = reponseVisitesSchema.parse({ genereA: now.toISOString(), jours: query.data.jours, visites });
  return json(body);
});
