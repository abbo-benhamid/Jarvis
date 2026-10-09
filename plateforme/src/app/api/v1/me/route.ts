import type { NextRequest } from "next/server";
import { reponseMoiSchema, type ReponseMoi } from "@/contracts/v1/moi";
import { enforceRateLimits, ipOf, json, requireBearer, route } from "../_lib/http";
import { realDataAllowed } from "@/server/launch";
import { accountTerritoire } from "@/server/territoires";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — le compte connecté (jeton d'accès obligatoire).
 * RGPD : liste fermée de champs, vérifiée par le contrat. Aucune donnée de santé, aucun téléphone, aucun aîné.
 * L1 : `emailVerifie` (e-mail confirmé) et `profilValide` (accompagnant validé par l'opérateur ; vrai pour les autres rôles).
 * T1 : `territoire` (zone de l'accompagnant, premier aîné de la famille, null pour l'opérateur).
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
    emailVerifie: user.emailVerifiedAt !== null,
    profilValide: user.role !== "ACCOMPAGNANT" || user.caregiverProfile?.validation === "VALIDE",
    preinscription: !realDataAllowed(),
    territoire: await accountTerritoire(user),
  });
  return json(body);
});
