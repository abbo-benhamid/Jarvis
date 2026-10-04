import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/guards";
import { trackEvent } from "@/server/sandbox/events";

/**
 * Pages vues (D15). On garde :
 * - les pages vues par un testeur dans son bac à sable (avec son code testeur) ;
 * - les vues anonymes des pages d'entrée (accueil, « Tester Koudmen »), sans aucun identifiant.
 * Rien pour les opérateurs ni pour les autres comptes.
 */
const schema = z.object({ path: z.string().startsWith("/").max(300) });
const PUBLIC_PATHS = new Set(["/", "/tester"]);

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const user = await getCurrentUser();
  const path = parsed.data.path.split("?")[0]!;
  if (user?.sandboxId) {
    await trackEvent(user, "page.view", { path });
  } else if (!user && PUBLIC_PATHS.has(path)) {
    await trackEvent(null, "page.view", { path });
  }
  return new NextResponse(null, { status: 204 });
}
