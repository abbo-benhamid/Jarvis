import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { sameScope } from "@/server/scope";
import { generateUniqueHomeCode } from "@/server/visits/service";
import { PRESENCE_REFUSAL_MESSAGES, presenceRefusal } from "@/server/visits/launch-guards";
import { homeCardQrContent, newHomeCardId, signHomeCardToken, verifyHomeCardToken } from "./qr-token";

/**
 * L1-B (L9, R7) : carte domicile imprimée (QR signé + code de secours à 6 caractères).
 * - Lecture : membres du cercle Lakou de l'aîné, opérateur (même monde).
 * - Régénération : propriétaire du profil ou payeur du cercle (« admin »), opérateur. Journalisée.
 * - Refus si les données réelles ne sont pas autorisées ou si l'accord de l'aîné manque (launch-guards).
 */

export type CardActor = { id: string; role: Role; firstName?: string; sandboxId: string | null };

export class PresenceError extends Error {
  constructor(
    message: string,
    readonly code: "INTROUVABLE" | "INTERDIT" = "INTERDIT",
  ) {
    super(message);
    this.name = "PresenceError";
  }
}

const NOT_FOUND = "Nous ne trouvons pas ce profil.";

const AINE_CARD_SELECT = {
  id: true,
  firstName: true,
  lastInitial: true,
  commune: true,
  ownerId: true,
  sandboxId: true,
  accordEtat: true,
  consentGiven: true,
  consentAt: true,
  homeCode: true,
  homeCardId: true,
  homeCardVersion: true,
  homeCardIssuedAt: true,
  members: { select: { userId: true, isPayer: true } },
} as const;

async function loadAine(aineId: string) {
  return db.aine.findUnique({ where: { id: aineId }, select: AINE_CARD_SELECT });
}
type CardAine = NonNullable<Awaited<ReturnType<typeof loadAine>>>;

function canRead(actor: CardActor, aine: CardAine): boolean {
  if (!sameScope(actor.sandboxId, aine.sandboxId)) return false;
  if (actor.role === "OPERATEUR") return true;
  if (actor.role === "FAMILLE") return aine.members.some((m) => m.userId === actor.id);
  return false;
}

/** Régénérer : propriétaire du profil, payeur du cercle, ou opérateur. */
export function canManageHomeCard(actor: CardActor, aine: Pick<CardAine, "ownerId" | "members" | "sandboxId">): boolean {
  if (!sameScope(actor.sandboxId, aine.sandboxId)) return false;
  if (actor.role === "OPERATEUR") return true;
  if (actor.role !== "FAMILLE") return false;
  return aine.ownerId === actor.id || aine.members.some((m) => m.userId === actor.id && m.isPayer);
}

function assertAllowed(aine: CardAine) {
  const refusal = presenceRefusal(aine);
  if (refusal) throw new PresenceError(PRESENCE_REFUSAL_MESSAGES[refusal]);
}

export type HomeCardView = {
  aineId: string;
  firstName: string;
  lastInitial: string | null;
  commune: string;
  code: string;
  version: number;
  issuedAt: Date;
  qrContent: string;
  canRegenerate: boolean;
};

/** Carte à imprimer. Crée l'identifiant de carte au premier affichage (aîné créé avant L1-B). */
export async function getHomeCard(actor: CardActor, aineId: string): Promise<HomeCardView> {
  const aine = await loadAine(aineId);
  if (!aine || !canRead(actor, aine)) throw new PresenceError(NOT_FOUND, "INTROUVABLE");
  assertAllowed(aine);
  let cardId = aine.homeCardId;
  if (!cardId) {
    const created = newHomeCardId();
    const r = await db.aine.updateMany({ where: { id: aine.id, homeCardId: null }, data: { homeCardId: created } });
    cardId = r.count === 1 ? created : (await db.aine.findUniqueOrThrow({ where: { id: aine.id }, select: { homeCardId: true } })).homeCardId!;
  }
  const token = await signHomeCardToken({ c: cardId, v: aine.homeCardVersion });
  return {
    aineId: aine.id,
    firstName: aine.firstName,
    lastInitial: aine.lastInitial,
    commune: aine.commune,
    code: aine.homeCode,
    version: aine.homeCardVersion,
    issuedAt: aine.homeCardIssuedAt,
    qrContent: homeCardQrContent(token),
    canRegenerate: canManageHomeCard(actor, aine),
  };
}

/**
 * Régénère la carte : nouvel identifiant de carte, version + 1, NOUVEAU code de secours.
 * L'ancienne carte (QR et code) est refusée dès maintenant. Journal : version seulement (jamais le code ni le jeton).
 */
export async function regenerateHomeCard(actor: CardActor, aineId: string): Promise<{ version: number }> {
  const aine = await loadAine(aineId);
  if (!aine || !canRead(actor, aine)) throw new PresenceError(NOT_FOUND, "INTROUVABLE");
  if (!canManageHomeCard(actor, aine)) {
    throw new PresenceError("Seul le gestionnaire du profil (ou l'équipe Koudmen) peut créer une nouvelle carte.");
  }
  assertAllowed(aine);
  const homeCode = await generateUniqueHomeCode();
  const updated = await db.aine.update({
    where: { id: aine.id },
    data: { homeCardId: newHomeCardId(), homeCardVersion: { increment: 1 }, homeCardIssuedAt: new Date(), homeCode },
    select: { homeCardVersion: true },
  });
  await logAudit({
    actor: { id: actor.id, role: actor.role },
    action: "aine.home_card.regenerated",
    entityType: "Aine",
    entityId: aine.id,
    metadata: { version: updated.homeCardVersion },
  });
  return { version: updated.homeCardVersion };
}

export type QrResolution =
  | { ok: true; aineId: string }
  /** FAUX : signature fausse ou carte inconnue. REVOQUE : ancienne version d'une carte connue. */
  | { ok: false; reason: "FAUX" | "REVOQUE" };

/**
 * Relie un jeton de QR à un aîné. Signature fausse → FAUX. Signature valide mais carte remplacée (identifiant
 * inconnu) ou version ancienne → REVOQUE. Les deux sont refusés au check-in.
 */
export async function resolveHomeCardToken(token: string): Promise<QrResolution> {
  const claims = await verifyHomeCardToken(token);
  if (!claims) return { ok: false, reason: "FAUX" };
  const aine = await db.aine.findUnique({ where: { homeCardId: claims.c }, select: { id: true, homeCardVersion: true } });
  // Signature valide mais carte inconnue : la carte a été régénérée (nouvel identifiant). Elle est révoquée.
  if (!aine) return { ok: false, reason: "REVOQUE" };
  if (aine.homeCardVersion !== claims.v) return { ok: false, reason: "REVOQUE" };
  return { ok: true, aineId: aine.id };
}
