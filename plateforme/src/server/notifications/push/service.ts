import "server-only";
import { Prisma, type PushPlatform, type Role } from "@prisma/client";
import { db, type DbClient } from "@/server/db";
import { logAudit } from "@/server/audit";
import type { TemplateKey } from "@/server/notification-templates";
import { pushPort } from "./adaptateur";
import type { MessagePush, PushPort } from "./port";
import { MODELES_PUSH, rendrePush } from "./templates";

/**
 * Service push (lot N1).
 *
 * Flux :
 * 1. L'app enregistre son jeton Expo (`POST /api/v1/appareils`) → `PushDevice`, lié à SA connexion (familyId).
 * 2. Le métier appelle `notifyUser` (outbox.ts) dans sa transaction → `enqueuePush` écrit un message
 *    `PUSH` / `EN_ATTENTE` dans l'Outbox, SI le modèle part en push et SI l'utilisateur a un appareil actif.
 * 3. Après la transaction, `flushPendingPushSafe()` envoie les messages en attente par le `PushPort`.
 *
 * Révocation :
 * - l'app retire son appareil avant la déconnexion (`DELETE /api/v1/appareils/{id}`) ;
 * - au moment de l'envoi, un appareil dont la connexion est fermée (famille révoquée ou expirée, déconnexion
 *   web « partout ») est révoqué (`DECONNEXION`) et ne reçoit rien ;
 * - réponse Expo `DeviceNotRegistered` → révoqué (`NON_ENREGISTRE`).
 */

/** Appareils actifs au plus par compte. Au-delà, les plus anciens sont révoqués. */
export const MAX_APPAREILS = 10;

export const REVOCATION_APPAREIL = {
  DECONNEXION: "DECONNEXION",
  NON_ENREGISTRE: "NON_ENREGISTRE",
  RETIRE: "RETIRE",
  TROP_APPAREILS: "TROP_APPAREILS",
} as const;

// ─────────────── Appareils ───────────────

export type EnregistrementAppareil = {
  userId: string;
  role: Role;
  familyId: string;
  jeton: string;
  plateforme: PushPlatform;
};

/** Enregistre (ou rafraîchit) le jeton de l'appareil. Un jeton déjà connu passe au compte connecté. */
export async function registerDevice(input: EnregistrementAppareil, now: Date = new Date()) {
  const upsert = () =>
    db.pushDevice.upsert({
      where: { token: input.jeton },
      create: { userId: input.userId, token: input.jeton, platform: input.plateforme, familyId: input.familyId, lastSeenAt: now },
      update: { userId: input.userId, platform: input.plateforme, familyId: input.familyId, lastSeenAt: now, revokedAt: null, revokedReason: null },
      select: { id: true, createdAt: true, lastSeenAt: true },
    });
  const before = await db.pushDevice.findUnique({ where: { token: input.jeton }, select: { userId: true, familyId: true, revokedAt: true } });
  let device;
  try {
    device = await upsert();
  } catch (e) {
    // Deux enregistrements simultanés du même jeton : le second relit la ligne créée par le premier.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") device = await upsert();
    else throw e;
  }

  const actifs = await db.pushDevice.findMany({
    where: { userId: input.userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });
  if (actifs.length > MAX_APPAREILS) {
    await db.pushDevice.updateMany({
      where: { id: { in: actifs.slice(MAX_APPAREILS).map((d) => d.id) } },
      data: { revokedAt: now, revokedReason: REVOCATION_APPAREIL.TROP_APPAREILS },
    });
  }

  const changed = !before || before.userId !== input.userId || before.familyId !== input.familyId || before.revokedAt !== null;
  if (changed) {
    // Jamais le jeton dans l'audit.
    await logAudit({
      actor: { id: input.userId, role: input.role },
      action: "push.device.registered",
      entityType: "PushDevice",
      entityId: device.id,
      metadata: { plateforme: input.plateforme, reattribue: Boolean(before && before.userId !== input.userId) },
    });
  }
  return device;
}

/** Retire un appareil du compte (idempotent ; un appareil d'un autre compte n'est pas touché). */
export async function unregisterDevice(userId: string, deviceId: string, now: Date = new Date()): Promise<boolean> {
  const r = await db.pushDevice.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: REVOCATION_APPAREIL.RETIRE },
  });
  return r.count === 1;
}

/**
 * Appareils qui peuvent recevoir un push : non révoqués ET dont la connexion de l'app est encore ouverte
 * (un jeton de renouvellement courant, non révoqué, non expiré). Les autres sont révoqués ici.
 */
export async function activeDevices(userId: string, now: Date = new Date(), client: DbClient = db) {
  const devices = await client.pushDevice.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, token: true, platform: true, familyId: true },
  });
  if (devices.length === 0) return [];
  const families = [...new Set(devices.map((d) => d.familyId))];
  const live = await client.refreshToken.findMany({
    where: { familyId: { in: families }, revokedAt: null, usedAt: null, expiresAt: { gt: now } },
    select: { familyId: true },
  });
  const liveSet = new Set(live.map((r) => r.familyId));
  const dead = devices.filter((d) => !liveSet.has(d.familyId));
  if (dead.length > 0) {
    await client.pushDevice.updateMany({
      where: { id: { in: dead.map((d) => d.id) }, revokedAt: null },
      data: { revokedAt: now, revokedReason: REVOCATION_APPAREIL.DECONNEXION },
    });
  }
  return devices.filter((d) => liveSet.has(d.familyId));
}

/** Efface les appareils révoqués depuis plus de `keepDays` jours. À brancher sur la purge nocturne. */
export async function purgePushDevices(now: Date = new Date(), keepDays = 30): Promise<number> {
  const limit = new Date(now.getTime() - keepDays * 86_400_000);
  const r = await db.pushDevice.deleteMany({ where: { revokedAt: { lt: limit } } });
  return r.count;
}

// ─────────────── Outbox ───────────────

/**
 * Ajoute un push à l'Outbox (dans la transaction du métier). Rien si le modèle ne part pas en push,
 * ou si l'utilisateur n'a aucun appareil actif. Le texte stocké est déjà le texte générique (R9).
 */
export async function enqueuePush(
  input: {
    userId: string;
    template: TemplateKey;
    vars: Record<string, string | number>;
    related?: { type: string; id: string };
    sandboxId?: string | null;
  },
  client: DbClient = db,
) {
  const rendu = rendrePush(input.template, input.vars, input.related?.id ?? null);
  if (!rendu) return null;
  const n = await client.pushDevice.count({ where: { userId: input.userId, revokedAt: null } });
  if (n === 0) return null;
  return client.outboxMessage.create({
    data: {
      channel: "PUSH",
      to: "Appareils de l'app",
      recipientUserId: input.userId,
      template: input.template,
      subject: rendu.titre,
      body: rendu.corps,
      status: "EN_ATTENTE",
      relatedType: input.related?.type ?? null,
      relatedId: input.related?.id ?? null,
      sandboxId: input.sandboxId ?? null,
    },
    select: { id: true },
  });
}

export type BilanEnvoi = { traites: number; envoyes: number; echecs: number };

/**
 * Envoie les push en attente (le plus ancien d'abord). Chaque message est « réservé » par une mise à jour
 * conditionnelle : deux envois simultanés n'envoient jamais deux fois le même message.
 */
export async function flushPendingPush(port: PushPort = pushPort(), now: Date = new Date(), limit = 50): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { traites: 0, envoyes: 0, echecs: 0 };
  const rows = await db.outboxMessage.findMany({
    where: { channel: "PUSH", status: "EN_ATTENTE" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, recipientUserId: true, template: true, subject: true, body: true, relatedId: true },
  });
  for (const row of rows) {
    const claimed = await db.outboxMessage.updateMany({
      where: { id: row.id, status: "EN_ATTENTE" },
      data: { status: port.nom === "console" ? "ENVOYE_SIMULE" : "ENVOYE", sentAt: now },
    });
    if (claimed.count !== 1) continue;
    bilan.traites++;
    const modele = MODELES_PUSH[row.template as TemplateKey];
    const devices = row.recipientUserId && modele ? await activeDevices(row.recipientUserId, now) : [];
    if (!modele || devices.length === 0) {
      await db.outboxMessage.update({ where: { id: row.id }, data: { status: "ECHEC", to: "Aucun appareil actif" } });
      bilan.echecs++;
      continue;
    }
    const donnees = modele.cible(row.relatedId);
    const messages: MessagePush[] = devices.map((d) => ({
      jeton: d.token,
      plateforme: d.platform,
      titre: row.subject ?? "Koudmen",
      corps: row.body,
      donnees,
    }));
    const resultats = await port.envoyer(messages);
    const morts = devices.filter((_d, i) => {
      const r = resultats[i];
      return r && !r.ok && r.appareilMort;
    });
    if (morts.length > 0) {
      await db.pushDevice.updateMany({
        where: { id: { in: morts.map((d) => d.id) } },
        data: { revokedAt: now, revokedReason: REVOCATION_APPAREIL.NON_ENREGISTRE },
      });
    }
    const ok = resultats.filter((r) => r.ok).length;
    await db.outboxMessage.update({
      where: { id: row.id },
      data: { to: `${ok}/${devices.length} appareil(s)`, ...(ok === 0 ? { status: "ECHEC" } : {}) },
    });
    if (ok > 0) bilan.envoyes++;
    else bilan.echecs++;
  }
  return bilan;
}

/** Version sûre pour le métier : une panne du push ne casse jamais l'action (Kayé, choix du profil). */
export async function flushPendingPushSafe(): Promise<void> {
  try {
    await flushPendingPush();
  } catch (e) {
    console.error(`[push] envoi impossible : ${e instanceof Error ? e.name : "erreur"}`);
  }
}
