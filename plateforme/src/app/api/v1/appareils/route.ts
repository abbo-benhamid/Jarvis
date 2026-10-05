import type { NextRequest } from "next/server";
import { demandeAppareilSchema, reponseAppareilSchema, type ReponseAppareil } from "@/contracts/v1/appareils";
import { registerDevice } from "@/server/notifications/push/service";
import { enforceRateLimits, ipOf, json, readBody, requireBearer, route } from "../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/appareils — enregistre le jeton Expo Push de l'appareil (lot N1).
 * Tout compte accepté par l'API (accompagnant, famille). L'appareil est lié à la connexion du jeton d'accès :
 * la déconnexion de cette connexion coupe le push. Un jeton déjà connu passe au compte connecté.
 * L'app rappelle cette route à chaque ouverture (le jeton peut changer).
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-appareils:${ipOf(req)}`]]);
  const { user, familyId } = await requireBearer(req);
  const { jeton, plateforme } = await readBody(req, demandeAppareilSchema);
  const device = await registerDevice({ userId: user.id, role: user.role, familyId, jeton, plateforme });
  const body: ReponseAppareil = reponseAppareilSchema.parse({ id: device.id, enregistreA: device.lastSeenAt.toISOString() });
  return json(body);
});
