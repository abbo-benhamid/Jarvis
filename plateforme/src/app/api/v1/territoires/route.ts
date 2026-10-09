import { reponseTerritoiresSchema, type ReponseTerritoires } from "@/contracts/v1/territoires";
import { TERRITOIRES, territoirePublic } from "@/lib/territoires";
import { route } from "../_lib/http";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/territoires — public, sans jeton (T1). Les 4 territoires : état, fuseau IANA, indicatifs, communes.
 * Données de configuration seulement (aucune donnée personnelle). Cache public d'une heure.
 */
export const GET = route(async () => {
  const body: ReponseTerritoires = reponseTerritoiresSchema.parse({ territoires: TERRITOIRES.map(territoirePublic) });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
});
