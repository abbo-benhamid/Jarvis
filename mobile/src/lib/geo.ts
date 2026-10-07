/**
 * Calculs de position (L1, trajet). Module PUR : aucun import React Native (testable sans appareil).
 */

export type Point = { latitude: number; longitude: number };

const RAYON_TERRE_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance à vol d'oiseau (haversine), en mètres. */
export function distanceMetres(a: Point, b: Point): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Arrondit une coordonnée (3 décimales ≈ 110 m en latitude, ≈ 108 m en longitude en Martinique). */
export function arrondir(valeur: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(valeur * f) / f;
}

/** « 350 m », « 1,2 km », « 12 km ». */
export function texteDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** Destination d'itinéraire : coordonnées précises, ou texte (quartier + commune) si le domicile est approximatif. */
export type Destination = { point: Point | null; texte: string };

/**
 * Lien vers l'app de cartes du téléphone, en mode voiture.
 * - iOS : Apple Plans (`maps.apple.com`, ouvert par l'app Plans).
 * - Android et web : Google Maps (lien universel `google.com/maps/dir`, ouvert par l'app si elle est installée).
 */
export function lienItineraire(plateforme: 'ios' | 'android' | 'web' | string, d: Destination): string {
  const cible = d.point ? `${d.point.latitude},${d.point.longitude}` : d.texte;
  const q = encodeURIComponent(cible);
  if (plateforme === 'ios') return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}
