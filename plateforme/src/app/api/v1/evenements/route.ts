import type { NextRequest } from "next/server";
import { demandeEvenementsSchema, reponseEvenementsSchema, type ReponseEvenements } from "@/contracts/v1/visits";
import { processAppEvents } from "@/server/visits/app-service";
import { enforceRateLimits, ipOf, json, readBody, route } from "../_lib/http";
import { requireAccompagnant } from "../visites/_lib/acces";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/evenements — lot d'événements de la file hors ligne de l'app (1 à 50), traités dans l'ordre.
 * - Idempotent par `clientEventId` (par compte) : un doublon renvoie le résultat d'origine (statut DOUBLON).
 * - Écart d'horloge > 12 h : la visite passe « À vérifier ».
 * - Profil suspendu ou non validé : chaque événement est refusé (COMPTE_INACTIF), sauf le SOS.
 * - Aucune position hors du check-in (pas de suivi continu).
 * Réponse 200 avec un résultat par événement ; un refus métier n'est pas une erreur HTTP.
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-evenements:${ipOf(req)}`]]);
  const user = await requireAccompagnant(req);
  const { evenements } = await readBody(req, demandeEvenementsSchema);
  const recuA = new Date();
  const resultats = await processAppEvents(user, evenements, recuA);
  const body: ReponseEvenements = reponseEvenementsSchema.parse({ recuA: recuA.toISOString(), resultats });
  return json(body);
});
