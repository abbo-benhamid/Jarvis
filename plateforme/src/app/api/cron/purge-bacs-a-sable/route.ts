import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { cronAuthorized } from "@/server/cron-auth";
import { purgeExpiredSandboxes, purgeRetention } from "@/server/sandbox/purge";
import { purgeAppData } from "@/server/app-retention";
import { flushPendingPushSafe } from "@/server/notifications/push/service";
import { testEndDate } from "@/server/env";
import { isLaunchMode } from "@/server/launch";
import { purgeLaunchData } from "@/server/launch-retention";
import { encryptLegacyHomeLocations } from "@/server/presence/address";
import { purgeVerificationData } from "@/server/verifications/review";

/**
 * Purge nocturne (Vercel Cron, vercel.json) : bacs à sable de plus de 30 jours (D2), puis durées de
 * conservation (M6) : visites découverte > 6 mois, avis et mesures à « fin du test + 6 mois ».
 * V1c (X9) : données de l'app (jetons, événements, brouillons de Kayé, appareils push), puis envoi
 * des push restés en attente (M2).
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> ». Sans CRON_SECRET configuré, la route refuse tout.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const now = new Date();
  const purged = await purgeExpiredSandboxes(db);
  const retention = await purgeRetention(db, now, testEndDate());
  const app = await purgeAppData(now);
  // L11 / L1-A : en lancement, tous les restes de bac à sable ; jetons de compte, comptes jamais confirmés, demandes de rappel.
  const lancement = await purgeLaunchData(isLaunchMode(), now);
  // L1d (D3) : positions précises géocodées avant L1d → chiffrées. Sans clé utilisable (préinscription), rien.
  let domicilesChiffres = 0;
  try {
    domicilesChiffres = await encryptLegacyHomeLocations();
  } catch {
    domicilesChiffres = -1;
  }
  // L2 : documents à J+30 après la décision, suppression chez le prestataire d'identité, codes SMS, échéances (B3).
  let verifications: Awaited<ReturnType<typeof purgeVerificationData>> | null = null;
  try {
    verifications = await purgeVerificationData(now);
  } catch (e) {
    console.error(`[cron] purge des vérifications : ${e instanceof Error ? e.name : "erreur"}`);
  }
  await db.auditLog.create({ data: { action: "sandbox.purged", entityType: "Sandbox", metadata: { purged, ...retention, app, lancement, domicilesChiffres, verifications } } });
  const push = await flushPendingPushSafe();
  return NextResponse.json({ purged, ...retention, app, lancement, domicilesChiffres, verifications, push });
}
