import { NextResponse, type NextRequest } from "next/server";
import { resumeSandbox } from "@/server/sandbox/service";
import { ROLE_HOME } from "@/lib/labels";

/** Lien de reprise secret (D2) : rouvre le bac à sable du testeur, sans mot de passe. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const role = await resumeSandbox(token);
  const url = req.nextUrl.clone();
  url.search = "";
  url.pathname = role ? ROLE_HOME[role] : "/tester";
  if (!role) url.searchParams.set("erreur", "lien");
  const res = NextResponse.redirect(url);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
