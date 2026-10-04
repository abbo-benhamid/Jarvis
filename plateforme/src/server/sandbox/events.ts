import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/server/db";
import { normalizePath } from "./scenarios";

/**
 * Événements d'usage (D15). Règles :
 * - aucun texte libre, aucune donnée personnelle, aucun identifiant de visite ou d'aîné dans `metadata` ;
 * - le code testeur relie l'événement au testeur ; l'événement reste après la purge du bac à sable.
 */
export type TrackActor = { id: string; role: Role; sandboxId: string | null } | null;

/** Noms d'événements autorisés (liste fermée). */
export const EVENT_NAMES = [
  "page.view",
  "sandbox.created",
  "sandbox.resumed",
  "simulate.step",
  "profile.chosen",
  "micro.answered",
  "discovery.requested",
  "discovery.declined",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

const testerCodeCache = new Map<string, string>();

async function testerCodeOf(sandboxId: string): Promise<string | null> {
  const cached = testerCodeCache.get(sandboxId);
  if (cached) return cached;
  const s = await db.sandbox.findUnique({ where: { id: sandboxId }, select: { testerCode: true } });
  if (s) testerCodeCache.set(sandboxId, s.testerCode);
  return s?.testerCode ?? null;
}

export async function trackEvent(
  actor: TrackActor,
  name: EventName,
  opts: { path?: string | null; metadata?: Prisma.InputJsonValue } = {},
): Promise<void> {
  const sandboxId = actor?.sandboxId ?? null;
  await db.usageEvent.create({
    data: {
      sandboxId,
      testerCode: sandboxId ? await testerCodeOf(sandboxId) : null,
      userId: actor?.id ?? null,
      role: actor?.role ?? null,
      name,
      path: opts.path ? normalizePath(opts.path) : null,
      metadata: opts.metadata,
    },
  });
  if (sandboxId) await db.sandbox.update({ where: { id: sandboxId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
}
