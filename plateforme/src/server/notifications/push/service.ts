import "server-only";
import { Prisma, type PushPlatform, type Role } from "@prisma/client";
import { after } from "next/server";
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
 * 3. Après la transaction, `schedulePushFlush()` envoie les messages en attente APRÈS la réponse HTTP (M2).
 *    La route cron `/api/cron/push` (et la purge nocturne) reprend ce qui reste.
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


/**
 * PM2 : le jeton est déjà lié à un AUTRE compte dont la connexion de l'app est encore ouverte.
 * Aucune preuve que la requête vient du même appareil : refus (la route répond 409 CONFLIT).
 */
export class PushDeviceConflictError extends Error {
  constructor() {
    super("Ce téléphone reçoit déjà les notifications d'un autre compte. Déconnectez d'abord l'autre compte de l'app.");
    this.name = "PushDeviceConflictError";
  }
}

/** Vrai si la connexion de l'app (famille de jetons) est encore ouverte : un jeton courant, non révoqué, non expiré. */
async function familyIsLive(familyId: string, now: Date): Promise<boolean> {
  const n = await db.refreshToken.count({ where: { familyId, revokedAt: null, usedAt: null, expiresAt: { gt: now } } });
  return n > 0;
}

/**
 * Enregistre (ou rafraîchit) le jeton de l'appareil pour le compte connecté.
 *
 * PM2 (sécurité) : un jeton déjà lié à un AUTRE compte n'est jamais repris sans preuve.
 * - Le lien de l'autre compte est mort (appareil retiré, ou connexion fermée : déconnexion, révocation,
 *   expiration) : l'ancienne ligne est effacée (audit chez l'ancien propriétaire) et une NOUVELLE ligne
 *   est créée (nouvel `id` : on ne renvoie jamais l'`id` d'une ligne d'un autre compte).
 * - Le lien de l'autre compte est vivant : `PushDeviceConflictError` (409). La preuve « même appareil »
 *   (identifiant d'installation) est au backlog pilote.
 */
export async function registerDevice(input: EnregistrementAppareil, now: Date = new Date()) {
  const select = { id: true, createdAt: true, lastSeenAt: true } as const;
  for (let essai = 0; essai < 3; essai++) {
    const before = await db.pushDevice.findUnique({ where: { token: input.jeton }, select: { id: true, userId: true, familyId: true, revokedAt: true } });

    if (before && before.userId === input.userId) {
      const device = await db.pushDevice.update({
        where: { id: before.id },
        data: { platform: input.plateforme, familyId: input.familyId, lastSeenAt: now, revokedAt: null, revokedReason: null },
        select,
      });
      if (before.familyId !== input.familyId || before.revokedAt !== null) await auditRegistered(input, device.id, false);
      await capDevices(input.userId, now);
      return device;
    }

    let reattribue = false;
    if (before) {
      if (before.revokedAt === null && (await familyIsLive(before.familyId, now))) throw new PushDeviceConflictError();
      const removed = await db.pushDevice.deleteMany({ where: { id: before.id, userId: before.userId } });
      if (removed.count === 1) {
        const old = await db.user.findUnique({ where: { id: before.userId }, select: { role: true } });
        await logAudit({
          actor: old ? { id: before.userId, role: old.role } : undefined,
          action: "push.device.removed",
          entityType: "PushDevice",
          entityId: before.id,
          metadata: { raison: "REATTRIBUE" },
        });
      }
      reattribue = true;
    }
    try {
      const device = await db.pushDevice.create({
        data: { userId: input.userId, token: input.jeton, platform: input.plateforme, familyId: input.familyId, lastSeenAt: now },
        select,
      });
      await auditRegistered(input, device.id, reattribue);
      await capDevices(input.userId, now);
      return device;
    } catch (e) {
      // Deux enregistrements simultanés du même jeton : on relit la ligne créée par l'autre requête.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  throw new PushDeviceConflictError();
}

async function auditRegistered(input: EnregistrementAppareil, deviceId: string, reattribue: boolean) {
  // Jamais le jeton dans l'audit.
  await logAudit({
    actor: { id: input.userId, role: input.role },
    action: "push.device.registered",
    entityType: "PushDevice",
    entityId: deviceId,
    metadata: { plateforme: input.plateforme, reattribue },
  });
}

/** Au plus MAX_APPAREILS appareils actifs par compte : les plus anciens sont révoqués. */
async function capDevices(userId: string, now: Date) {
  const actifs = await db.pushDevice.findMany({ where: { userId, revokedAt: null }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
  if (actifs.length > MAX_APPAREILS) {
    await db.pushDevice.updateMany({
      where: { id: { in: actifs.slice(MAX_APPAREILS).map((d) => d.id) } },
      data: { revokedAt: now, revokedReason: REVOCATION_APPAREIL.TROP_APPAREILS },
    });
  }
}

/** Retire un appareil du compte (idempotent ; un appareil d'un autre compte n'est pas touché). Journalisé (sécurité m3). */
export async function unregisterDevice(userId: string, deviceId: string, now: Date = new Date()): Promise<boolean> {
  const r = await db.pushDevice.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: REVOCATION_APPAREIL.RETIRE },
  });
  if (r.count === 1) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    await logAudit({
      actor: u ? { id: userId, role: u.role } : undefined,
      action: "push.device.removed",
      entityType: "PushDevice",
      entityId: deviceId,
      metadata: { raison: REVOCATION_APPAREIL.RETIRE },
    });
  }
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

/** Efface les appareils révoqués depuis plus de `keepDays` jours. Appelée par la purge nocturne (X9). */
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

/** m1 : essais au plus pour un message push avant l'échec définitif (panne passagère du fournisseur). */
export const MAX_ESSAIS_PUSH = 3;
/** Un message `EN_COURS` depuis plus longtemps est repris (processus arrêté pendant l'envoi). */
export const DELAI_REPRISE_PUSH_MS = 5 * 60_000;

/**
 * Envoie les push en attente (le plus ancien d'abord). Chaque message est « réservé » par une mise à jour
 * conditionnelle (EN_ATTENTE → EN_COURS) : deux envois simultanés n'envoient jamais deux fois le même message.
 * m1 : le message passe ENVOYE (ou ENVOYE_SIMULE) seulement APRÈS un succès. Échec passager : retour
 * EN_ATTENTE (nouvel essai au prochain envoi), ECHEC définitif après MAX_ESSAIS_PUSH essais.
 */
export async function flushPendingPush(
  port: PushPort = pushPort(),
  now: Date = new Date(),
  opts: { limit?: number; userIds?: string[] } = {},
): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { traites: 0, envoyes: 0, echecs: 0 };
  const stale = new Date(now.getTime() - DELAI_REPRISE_PUSH_MS);
  const rows = await db.outboxMessage.findMany({
    where: {
      channel: "PUSH",
      OR: [{ status: "EN_ATTENTE" }, { status: "EN_COURS", sentAt: { lt: stale } }],
      ...(opts.userIds ? { recipientUserId: { in: opts.userIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
    select: { id: true, status: true, sentAt: true, attempts: true, recipientUserId: true, template: true, subject: true, body: true, relatedId: true },
  });
  for (const row of rows) {
    const claimed = await db.outboxMessage.updateMany({
      where: { id: row.id, status: row.status, sentAt: row.sentAt },
      data: { status: "EN_COURS", sentAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    bilan.traites++;
    const attempts = row.attempts + 1;
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
    if (ok > 0) {
      await db.outboxMessage.update({
        where: { id: row.id },
        data: { status: port.nom === "console" ? "ENVOYE_SIMULE" : "ENVOYE", to: `${ok}/${devices.length} appareil(s)` },
      });
      bilan.envoyes++;
      continue;
    }
    // Aucun succès. Tous les appareils morts, ou trop d'essais : échec définitif. Sinon : nouvel essai plus tard.
    const definitif = morts.length === devices.length || attempts >= MAX_ESSAIS_PUSH;
    await db.outboxMessage.update({
      where: { id: row.id },
      data: definitif
        ? { status: "ECHEC", to: `0/${devices.length} appareil(s)` }
        : { status: "EN_ATTENTE", to: `Essai ${attempts}/${MAX_ESSAIS_PUSH} sans succès` },
    });
    bilan.echecs++;
  }
  return bilan;
}

/** Version sûre pour le métier : une panne du push ne casse jamais l'action (Kayé, choix du profil). */
export async function flushPendingPushSafe(opts: { limit?: number } = {}): Promise<BilanEnvoi | null> {
  try {
    return await flushPendingPush(pushPort(), new Date(), opts);
  } catch (e) {
    console.error(`[push] envoi impossible : ${e instanceof Error ? e.name : "erreur"}`);
    return null;
  }
}

/**
 * M2 : programme l'envoi des push APRÈS la réponse HTTP (`after` de Next.js). La requête métier
 * n'attend jamais le fournisseur. Hors d'une requête (script, test), `after` lève une erreur : rien n'est
 * lancé, les messages restent EN_ATTENTE et partent avec la route cron (`/api/cron/push`) ou le prochain envoi.
 * `lancer` : injectable pour les tests. Renvoie true si l'envoi est programmé.
 */
export function schedulePushFlush(lancer: (tache: () => Promise<unknown>) => void = after): boolean {
  try {
    lancer(() => flushPendingPushSafe({ limit: 20 }));
    return true;
  } catch {
    return false;
  }
}
