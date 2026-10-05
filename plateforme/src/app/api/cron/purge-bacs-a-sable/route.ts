import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { cronSecret } from "@/server/env";
import { purgeExpiredSandboxes, purgeRetention } from "@/server/sandbox/purge";
import { testEndDate } from "@/server/env";

/**
 * Purge nocturne (Vercel Cron, vercel.json) : bacs à sable de plus de 30 jours (D2), puis durées de
 * conservation (M6) : visites découverte > 6 mois, avis et mesures à « fin du test + 6 mois ».
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> ». Sans CRON_SECRET configuré, la route refuse tout.
 */
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const purged = await purgeExpiredSandboxes(db);
  const retention = await purgeRetention(db, new Date(), testEndDate());
  await db.auditLog.create({ data: { action: "sandbox.purged", entityType: "Sandbox", metadata: { purged, ...retention } } });
  return NextResponse.json({ purged, ...retention });
}
