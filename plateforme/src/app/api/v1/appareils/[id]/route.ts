import type { NextRequest } from "next/server";
import { identifiantSchema } from "@/contracts/v1/visits";
import { unregisterDevice } from "@/server/notifications/push/service";
import { enforceRateLimits, ipOf, noContent, requireBearer, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/v1/appareils/:id — retire l'appareil (l'app l'appelle AVANT /auth/logout).
 * Idempotent : 204 même si l'appareil est inconnu, déjà retiré ou d'un autre compte (ne révèle rien).
 */
export const DELETE = route(async (req: NextRequest) => {
  await enforceRateLimits([["evenement:ip", `api-v1-appareils:${ipOf(req)}`]]);
  const { user } = await requireBearer(req);
  const raw = decodeURIComponent(req.nextUrl.pathname.split("/").filter(Boolean).at(-1) ?? "");
  const id = identifiantSchema.safeParse(raw);
  if (id.success) await unregisterDevice(user.id, id.data);
  return noContent();
});
