import type { NextRequest } from "next/server";
import { reponseMoiSchema, type ReponseMoi } from "@/contracts/v1/moi";
import { enforceRateLimits, ipOf, json, requireBearer, route } from "../_lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — le compte connecté (jeton d'accès obligatoire).
 * RGPD : liste fermée de champs, vérifiée par le contrat. Aucune donnée de santé, aucun téléphone, aucun aîné.
 */
export const GET = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-me:${ipOf(req)}`]]);
  const { user } = await requireBearer(req);
  const body: ReponseMoi = reponseMoiSchema.parse({
    id: user.id,
    role: user.role,
    prenom: user.firstName,
    nom: user.lastName,
    email: user.email,
    demo: user.isDemo,
    bacASable: user.sandboxId !== null,
  });
  return json(body);
});
