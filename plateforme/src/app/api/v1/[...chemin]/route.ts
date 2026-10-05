import { apiError } from "../_lib/http";

export const dynamic = "force-dynamic";

/** Toute route /api/v1 inconnue : 404 au format d'erreur unique (jamais une page HTML). */
function notFound() {
  return apiError("INTROUVABLE", "Cette adresse de l'API n'existe pas.");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
