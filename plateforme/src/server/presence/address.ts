import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { getCommune } from "@/lib/communes";
import { geocodagePort } from "@/server/geocodage";
import { presenceRefusal, type PresenceGuardAine } from "@/server/visits/launch-guards";
import { decryptAddress, encryptAddress } from "./address-crypto";

/**
 * L1-B (L8, R7) : adresse réelle de l'aîné.
 * - Saisie par la famille (payeur), CHIFFRÉE en base (AES-256-GCM), géocodée par le port de géocodage.
 * - Repli : centre de la commune et `locationApproximate = true` (adresse introuvable, service muet, pas d'adresse).
 * - Lue par l'accompagnant SEULEMENT le jour de la visite ; chaque lecture est journalisée (sans l'adresse).
 * - Refusée si les données réelles ne sont pas autorisées ou si l'accord de l'aîné manque (launch-guards).
 */

export const ADDRESS_MAX = 200;

export type HomeLocation = {
  addressEnc: string | null;
  latitude: number;
  longitude: number;
  locationApproximate: boolean;
  geocodedAt: Date | null;
};

/** Position du domicile pour une adresse (ou null) dans une commune. Ne lève pas si le géocodage échoue. */
export async function computeHomeLocation(address: string | null, communeCode: string, now: Date = new Date()): Promise<HomeLocation & { label: string | null }> {
  const commune = getCommune(communeCode);
  if (!commune) throw new Error("Commune inconnue.");
  const fallback = { latitude: commune.lat, longitude: commune.lng, locationApproximate: true, geocodedAt: null, label: null };
  const clean = address?.trim().slice(0, ADDRESS_MAX) || null;
  if (!clean) return { addressEnc: null, ...fallback };
  const r = await geocodagePort().geocoder({ adresse: clean, commune: commune.label });
  const addressEnc = encryptAddress(clean);
  if (!r) return { addressEnc, ...fallback };
  return { addressEnc, latitude: r.latitude, longitude: r.longitude, locationApproximate: r.approximatif, geocodedAt: now, label: r.libelle };
}

/** Motif de refus de la saisie d'une adresse (null si permise). */
export function addressRefusal(aine: PresenceGuardAine): string | null {
  const r = presenceRefusal(aine);
  return r ? "L'adresse exacte n'est pas encore enregistrée : l'accord de l'aîné ou l'ouverture du service manque." : null;
}

/** Adresse en clair pour le cercle Lakou et l'opérateur (l'accès est contrôlé par l'appelant). */
export function readAddress(aine: { addressEnc: string | null }): string | null {
  return decryptAddress(aine.addressEnc);
}

const TZ = "America/Martinique";
function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Le jour de la visite (heure de Martinique). */
export function isVisitDay(scheduledStart: Date, now: Date): boolean {
  return dayKey(scheduledStart) === dayKey(now);
}

/**
 * Adresse pour l'accompagnant DE LA VISITE, le jour de la visite seulement. Chaque lecture est journalisée
 * (`aine.address.read`, sans l'adresse). Null sinon (autre jour, pas d'adresse, accès refusé).
 */
export async function readAddressForCaregiver(actor: { id: string; role: Role }, visitId: string, now: Date = new Date()): Promise<string | null> {
  if (actor.role !== "ACCOMPAGNANT") return null;
  const visit = await db.visit.findFirst({
    where: { id: visitId, caregiver: { userId: actor.id }, mission: { status: "ACTIVE" } },
    select: { id: true, scheduledStart: true, aineId: true, aine: { select: { addressEnc: true, accordEtat: true, consentGiven: true, consentAt: true, sandboxId: true } } },
  });
  if (!visit || !visit.aine.addressEnc || !isVisitDay(visit.scheduledStart, now) || presenceRefusal(visit.aine)) return null;
  const address = decryptAddress(visit.aine.addressEnc);
  if (address) {
    await logAudit({ actor, action: "aine.address.read", entityType: "Aine", entityId: visit.aineId, metadata: { visitId: visit.id } });
  }
  return address;
}
