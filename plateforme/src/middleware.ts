import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session-token";
import { isStrictProduction, productionConfigProblems, secretProblem } from "@/server/config-check";

/**
 * Première barrière (edge) : sans session valide, pas d'accès aux espaces privés.
 * La vraie autorisation reste requireRole() dans chaque page, action et route handler.
 */
/** Préfixes des espaces privés (session obligatoire). */
const PRIVATE_PREFIXES = ["/famille", "/accompagnant", "/operateur"];

/** Page 503 affichée quand la configuration de production est refusée (aucune valeur secrète). */
function configErrorPage(problems: string[]): NextResponse {
  const items = problems.map((p) => `<li>${p.replace(/[<>&]/g, "")}</li>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Koudmen — configuration incomplète</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5"><h1>Configuration incomplète</h1><p>Le site est en ligne, mais il refuse de démarrer pour protéger les données. Corrigez ces variables dans Vercel (Settings → Environment Variables), puis redéployez :</p><ul>${items}</ul></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function middleware(req: NextRequest) {
  // B1, B3 : configuration de production refusée → toutes les pages expliquent pourquoi.
  const problems = productionConfigProblems();
  if (problems.length > 0) return configErrorPage(problems);
  if (!PRIVATE_PREFIXES.some((p) => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
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
  // Toutes les pages, sauf les fichiers statiques et le diagnostic /api/sante.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/sante).*)"],
};
