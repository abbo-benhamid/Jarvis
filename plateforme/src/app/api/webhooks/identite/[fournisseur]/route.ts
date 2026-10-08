import { NextResponse, type NextRequest } from "next/server";
import { clientIpFrom, hitRateLimits } from "@/server/rate-limit";
import { isLaunchMode } from "@/server/config-check";
import { processIdentityWebhook } from "@/server/verifications/service";

export const dynamic = "force-dynamic";

const PROVIDERS = ["veriff", "stripe", "simule"] as const;
type Provider = (typeof PROVIDERS)[number];
/** Corps d'un webhook de décision : petit. Au-delà : refus sans lecture. */
const MAX_BODY = 64 * 1024;

/**
 * POST /api/webhooks/identite/{veriff|stripe|simule} — décision du prestataire d'identité (étude § 8.2).
 * 1. Corps BRUT lu avant tout parsage ; signature contrôlée par l'adaptateur (HMAC, temps constant).
 * 2. Idempotence par identifiant d'événement (WebhookEvent). 3. Réponse 200 rapide, sans détail.
 * La route `simule` n'existe pas en mode lancement (404). Aucune image ni donnée de la pièce dans le journal.
 * [À VÉRIFIER] Traitement dans un worker (JobQueuePort) : aujourd'hui dans la requête (quelques requêtes SQL).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ fournisseur: string }> }) {
  const { fournisseur } = await ctx.params;
  if (!(PROVIDERS as readonly string[]).includes(fournisseur)) return NextResponse.json({ ok: false }, { status: 404 });
  const provider = fournisseur as Provider;
  if (provider === "simule" && isLaunchMode()) return NextResponse.json({ ok: false }, { status: 404 });
  const limit = await hitRateLimits([["webhook:ip", `webhook:${clientIpFrom(req.headers)}`]]);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  try {
    const r = await processIdentityWebhook(provider, raw, req.headers);
    return NextResponse.json({ ok: r.status === 200 }, { status: r.status, headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[webhook:identite:${provider}] ${e instanceof Error ? e.name : "erreur"}`);
    // 500 : le prestataire rejouera l'envoi.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
