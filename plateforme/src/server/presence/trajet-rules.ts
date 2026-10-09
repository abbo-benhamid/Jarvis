/**
 * L1-B (L6, R4) : règles PURES du trajet en direct (sans base, testables seules).
 */
import { TRAJET_DUREE_MAX_MIN, TRAJET_INTERVALLE_POSITION_S } from "@/contracts/v1/trajet";
import { haversineMeters } from "@/server/visits/proof";

export const TRAJET_DUREE_MS = TRAJET_DUREE_MAX_MIN * 60_000;
/** Tolérance réseau sur l'intervalle de 30 s (une position envoyée à 29 s passe). */
export const TRAJET_TOLERANCE_INTERVALLE_MS = 2_000;
export const TRAJET_INTERVALLE_MIN_MS = TRAJET_INTERVALLE_POSITION_S * 1000 - TRAJET_TOLERANCE_INTERVALLE_MS;
/** R4 : rien n'est montré tant que l'accompagnant est à moins de 500 m de son point de départ. */
export const DEPART_MASQUE_METRES = 500;
/** R4 : le partage s'arrête seul à moins de 150 m du domicile. */
export const ARRIVEE_METRES = 150;
/** Une position plus vieille que ceci (file hors ligne) n'est pas gardée. */
export const POSITION_PERIMEE_MS = 5 * 60_000;
/** Fenêtre de démarrage : de 2 h avant le début à la fin prévue de la visite. */
export const TRAJET_DEMARRAGE_AVANT_MS = 2 * 3_600_000;

/** R4 : coordonnées arrondies à 3 décimales (~110 m). */
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Précision affichée : jamais plus fine que l'arrondi (~110 m). */
export function roundedAccuracy(precisionMetres: number): number {
  return Math.max(110, Math.round(precisionMetres / 10) * 10);
}

export type Point = { lat: number; lng: number };

/** Départ masqué : true tant que la position est à moins de 500 m du point de départ. */
export function departureMasked(start: Point | null, current: Point): boolean {
  if (!start) return true;
  return haversineMeters(start, current) < DEPART_MASQUE_METRES;
}

/** Arrivée : à moins de 150 m du domicile (jamais avec un domicile approximatif). */
export function arrivedHome(current: Point, home: Point & { approximate: boolean }): boolean {
  if (home.approximate) return false;
  return haversineMeters(current, home) <= ARRIVEE_METRES;
}

/**
 * Minutes estimées jusqu'au domicile. [À VÉRIFIER] avec le terrain : facteur de détour 1,4 et 30 km/h
 * de moyenne (routes des Antilles, bouchons). Arrondi à la minute supérieure, 1 minute au moins.
 */
export const DETOUR_FACTOR = 1.4;
export const VITESSE_MOYENNE_KMH = 30;
export function estimateMinutes(distanceMeters: number): number {
  const km = (distanceMeters * DETOUR_FACTOR) / 1000;
  return Math.max(1, Math.ceil((km / VITESSE_MOYENNE_KMH) * 60));
}

/** Le trajet peut-il démarrer maintenant ? De 2 h avant le début à la fin prévue, avant le check-in. */
export function canStartTrip(visit: { scheduledStart: Date; scheduledEnd: Date; checkInAt: Date | null; checkOutAt: Date | null }, now: Date): "OK" | "TROP_TOT" | "TROP_TARD" | "DEJA_ARRIVE" {
  if (visit.checkInAt || visit.checkOutAt) return "DEJA_ARRIVE";
  if (now.getTime() < visit.scheduledStart.getTime() - TRAJET_DEMARRAGE_AVANT_MS) return "TROP_TOT";
  if (now.getTime() > visit.scheduledEnd.getTime()) return "TROP_TARD";
  return "OK";
}

/** Heure de la position retenue : jamais dans le futur du serveur. Null si la position est périmée. */
export function positionTime(survenuA: Date, receivedAt: Date): Date | null {
  if (receivedAt.getTime() - survenuA.getTime() > POSITION_PERIMEE_MS) return null;
  return survenuA.getTime() > receivedAt.getTime() ? receivedAt : survenuA;
}

/** Personnes qui voient le trajet (R4) : l'employeur (payeur du profil) et la personne désignée, si elle est du cercle. */
export function tripViewerIds(aine: { tripViewerId: string | null; members: { userId: string; isPayer: boolean }[] }): Set<string> {
  const ids = new Set(aine.members.filter((m) => m.isPayer).map((m) => m.userId));
  if (aine.tripViewerId && aine.members.some((m) => m.userId === aine.tripViewerId)) ids.add(aine.tripViewerId);
  return ids;
}
