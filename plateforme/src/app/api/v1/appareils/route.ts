import type { NextRequest } from "next/server";
import { demandeAppareilSchema, reponseAppareilSchema, type ReponseAppareil } from "@/contracts/v1/appareils";
import { PushDeviceConflictError, registerDevice } from "@/server/notifications/push/service";
import { ApiError, enforceRateLimits, ipOf, json, readBody, requireBearer, route } from "../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/appareils — enregistre le jeton Expo Push de l'appareil (lot N1).
 * Tout compte accepté par l'API (accompagnant, famille). L'appareil est lié à la connexion du jeton d'accès :
 * la déconnexion de cette connexion coupe le push. L'app rappelle cette route à chaque ouverture (le jeton peut changer).
 * PM2 : un jeton lié à un AUTRE compte encore connecté n'est pas repris → 409 CONFLIT.
 */
export const POST = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-appareils:${ipOf(req)}`]]);
  const { user, familyId } = await requireBearer(req);
  const { jeton, plateforme } = await readBody(req, demandeAppareilSchema);
  let device;
  try {
    device = await registerDevice({ userId: user.id, role: user.role, familyId, jeton, plateforme });
  } catch (e) {
    if (e instanceof PushDeviceConflictError) throw new ApiError("CONFLIT", e.message);
    throw e;
  }
  const body: ReponseAppareil = reponseAppareilSchema.parse({ id: device.id, enregistreA: device.lastSeenAt.toISOString() });
  return json(body);
});
