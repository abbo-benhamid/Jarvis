import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session-token";
import { isStrictProduction, secretProblem } from "@/server/config-check";

/**
 * Première barrière (edge) : sans session valide, pas d'accès aux espaces privés.
 * La vraie autorisation reste requireRole() dans chaque page, action et route handler.
 */
export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  // B3 : en production, un secret d'exemple ne valide aucune session.
  const usable = secret && secret.length >= 32 && !(isStrictProduction() && secretProblem("SESSION_SECRET", secret));
  const session = usable ? await verifySessionToken(token, new TextEncoder().encode(secret)) : null;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/famille/:path*", "/accompagnant/:path*", "/operateur/:path*"],
};
