import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session-token";

/**
 * Première barrière (edge) : sans session valide, pas d'accès aux espaces privés.
 * La vraie autorisation reste requireRole() dans chaque page, action et route handler.
 */
export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session =
    secret && secret.length >= 32 ? await verifySessionToken(token, new TextEncoder().encode(secret)) : null;
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
