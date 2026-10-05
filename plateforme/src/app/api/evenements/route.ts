import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/guards";
import { trackEvent } from "@/server/sandbox/events";
import { clientIpFrom, hitRateLimit } from "@/server/rate-limit";

/**
 * Pages vues (D15). On garde :
 * - les pages vues par un testeur dans son bac à sable (avec son code testeur) ;
 * - les vues anonymes des pages d'entrée (accueil, « Tester Koudmen »), sans aucun identifiant.
 * Rien pour les opérateurs ni pour les autres comptes.
 * M4 / m6 : limite par IP (toutes les vues, et plus basse pour les vues anonymes). Au-delà : 429, rien n'est écrit.
 */
const schema = z.object({ path: z.string().startsWith("/").max(300) });
const PUBLIC_PATHS = new Set(["/", "/tester"]);

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const user = await getCurrentUser();
  const path = parsed.data.path.split("?")[0]!;
  const sandboxView = Boolean(user?.sandboxId);
  const anonymousView = !user && PUBLIC_PATHS.has(path);
  if (!sandboxView && !anonymousView) return new NextResponse(null, { status: 204 });

  const ip = clientIpFrom(req.headers);
  const limited = await hitRateLimit(anonymousView ? "evenement-anonyme:ip" : "evenement:ip", ip);
  if (!limited.allowed) {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
  }
  await trackEvent(sandboxView ? user : null, "page.view", { path });
  return new NextResponse(null, { status: 204 });
}
