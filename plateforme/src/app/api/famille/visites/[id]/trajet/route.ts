import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/guards";
import { getFamilyTripView } from "@/server/presence/trajet";
import { reponseTrajetFamilleSchema } from "@/contracts/v1/trajet";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

/**
 * GET /api/famille/visites/:id/trajet — « Où en est la visite » (L6, R4), cookie de session famille.
 * Réservé à l'employeur (payeur) et à la personne désignée par l'aîné ; sinon 404 (rien n'est révélé).
 * Hors trajet ou départ masqué : seulement l'heure prévue (jamais « non partagé »). Interrogée toutes les 10 s.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous." } }, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return notFound();
  const view = await getFamilyTripView(user, id);
  if (!view) return notFound();
  return NextResponse.json(reponseTrajetFamilleSchema.parse(view), { headers: NO_STORE });
}

function notFound() {
  return NextResponse.json({ erreur: { code: "INTROUVABLE", message: "Visite introuvable." } }, { status: 404, headers: NO_STORE });
}
