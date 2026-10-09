import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { fuseauDe, getCommune, territoire } from "@/lib/territoires";
import { geocodagePort } from "@/server/geocodage";
import { presenceRefusal, type PresenceGuardAine } from "@/server/visits/launch-guards";
import { decryptAddress, decryptHomeGeo, encryptAddress, encryptHomeGeo } from "./address-crypto";

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
  /** D3 : centre de la commune seulement (en clair). */
  latitude: number;
  longitude: number;
  /** D3 : position précise du domicile, chiffrée (null sans géocodage réussi). */
  homeGeoEnc: string | null;
  locationApproximate: boolean;
  geocodedAt: Date | null;
};

/**
 * Position du domicile pour une adresse (ou null) dans une commune. Ne lève pas si le géocodage échoue.
 * L1d (D3) : en clair, seulement le centre de la commune ; la position précise est chiffrée (`homeGeoEnc`).
 */
export async function computeHomeLocation(address: string | null, communeCode: string, now: Date = new Date()): Promise<HomeLocation & { label: string | null }> {
  const commune = getCommune(communeCode);
  if (!commune) throw new Error("Commune inconnue.");
  const fallback = { latitude: commune.lat, longitude: commune.lng, homeGeoEnc: null, locationApproximate: true, geocodedAt: null, label: null };
  const clean = address?.trim().slice(0, ADDRESS_MAX) || null;
  if (!clean) return { addressEnc: null, ...fallback };
  const r = await geocodagePort().geocoder({
    adresse: clean,
    commune: commune.label,
    prefixesCodePostal: territoire(commune.territoire).prefixesCodePostal,
    codePostal: commune.codePostal,
  });
  const addressEnc = encryptAddress(clean);
  if (!r) return { addressEnc, ...fallback };
  return {
    addressEnc,
    latitude: commune.lat,
    longitude: commune.lng,
    homeGeoEnc: encryptHomeGeo({ lat: r.latitude, lng: r.longitude }),
    locationApproximate: r.approximatif,
    geocodedAt: now,
    label: r.libelle,
  };
}

export type HomePointSource = { latitude: number; longitude: number; locationApproximate: boolean; homeGeoEnc?: string | null };

/**
 * D3 : point du domicile pour les calculs (check-in, arrivée du trajet, vue famille, SOS). Déchiffré en mémoire
 * seulement, jamais journalisé. Sans position précise lisible : le point en clair (centre de la commune),
 * marqué approximatif s'il l'est en base.
 */
export function homePoint(aine: HomePointSource): { lat: number; lng: number; approximate: boolean } {
  const precise = aine.homeGeoEnc ? decryptHomeGeo(aine.homeGeoEnc) : null;
  if (precise) return { ...precise, approximate: aine.locationApproximate };
  // Position chiffrée illisible (autre clé) : on ne compare rien à un faux domicile.
  return { lat: aine.latitude, lng: aine.longitude, approximate: aine.homeGeoEnc ? true : aine.locationApproximate };
}

/**
 * D3 : reprise. Les aînés géocodés AVANT L1d ont la position précise en clair. La purge nocturne la chiffre
 * (`homeGeoEnc`) et remet en clair le centre de la commune. Renvoie le nombre de fiches traitées.
 */
export async function encryptLegacyHomeLocations(limit = 500): Promise<number> {
  const rows = await db.aine.findMany({
    where: { homeGeoEnc: null, geocodedAt: { not: null } },
    select: { id: true, commune: true, latitude: true, longitude: true },
    take: limit,
  });
  let done = 0;
  for (const a of rows) {
    const commune = getCommune(a.commune);
    if (!commune) continue;
    if (a.latitude === commune.lat && a.longitude === commune.lng) continue;
    const r = await db.aine.updateMany({
      where: { id: a.id, homeGeoEnc: null, latitude: a.latitude, longitude: a.longitude },
      data: { homeGeoEnc: encryptHomeGeo({ lat: a.latitude, lng: a.longitude }), latitude: commune.lat, longitude: commune.lng },
    });
    done += r.count;
  }
  return done;
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

function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Le jour de la visite, dans le fuseau du territoire de l'aîné (T4). */
export function isVisitDay(scheduledStart: Date, now: Date, tz: string = fuseauDe(null)): boolean {
  return dayKey(scheduledStart, tz) === dayKey(now, tz);
}

/**
 * Adresse pour l'accompagnant DE LA VISITE, le jour de la visite seulement. Chaque lecture est journalisée
 * (`aine.address.read`, sans l'adresse). Null sinon (autre jour, pas d'adresse, accès refusé).
 */
export async function readAddressForCaregiver(actor: { id: string; role: Role }, visitId: string, now: Date = new Date()): Promise<string | null> {
  if (actor.role !== "ACCOMPAGNANT") return null;
  const visit = await db.visit.findFirst({
    where: { id: visitId, caregiver: { userId: actor.id }, mission: { status: "ACTIVE" } },
    select: { id: true, scheduledStart: true, aineId: true, aine: { select: { territoire: true, addressEnc: true, accordEtat: true, consentGiven: true, consentAt: true, sandboxId: true } } },
  });
  if (!visit || !visit.aine.addressEnc || !isVisitDay(visit.scheduledStart, now, fuseauDe(visit.aine.territoire)) || presenceRefusal(visit.aine)) return null;
  const address = decryptAddress(visit.aine.addressEnc);
  if (address) {
    await logAudit({ actor, action: "aine.address.read", entityType: "Aine", entityId: visit.aineId, metadata: { visitId: visit.id } });
  }
  return address;
}
