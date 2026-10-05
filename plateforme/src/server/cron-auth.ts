import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/server/env";

/**
 * Routes cron (Vercel Cron) : en-tête « Authorization: Bearer <CRON_SECRET> », comparé en temps constant.
 * Sans CRON_SECRET configuré (ou valeur refusée en production), la route refuse tout.
 */
export function cronAuthorized(authorization: string | null): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const given = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
