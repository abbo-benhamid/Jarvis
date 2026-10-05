import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/server/cron-auth";
import { flushPendingPushSafe } from "@/server/notifications/push/service";

/**
 * V1c (code M2, m2) : envoie les push restés en attente (message créé dans une transaction externe,
 * envoi après la réponse interrompu, échec passager du fournisseur, envoi « en cours » orphelin).
 * Protégée par CRON_SECRET. À appeler par un planificateur (Vercel Cron, Clever Cloud cron).
 * [À VÉRIFIER] fréquence permise par l'offre Vercel : la purge nocturne vide aussi la file une fois par nuit.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const push = await flushPendingPushSafe();
  return NextResponse.json({ push });
}
