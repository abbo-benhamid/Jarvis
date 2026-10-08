/**
 * Preuve de visite « 2 facteurs sur 3 » (docs/00, docs/05). Fonctions PURES.
 *  (a) GPS : UNE position au check-in, consentie. Jamais de suivi continu.
 *  (b) Code domicile : QR signé de la carte domicile (L9), ou code de 6 caractères en secours.
 *  (c) Confirmation de l'aîné : appel vocal « tapez 1 » (simulé dans le MVP), ou décision de la famille employeur (R7).
 */
import type { ProofFactor, VisitStatus } from "@prisma/client";

/** L10 : rayon autour du domicile pour valider le GPS. [À VÉRIFIER] avec le terrain (relief, précision). */
export const GPS_RADIUS_METERS = 150;
/** L10 : la précision annoncée s'ajoute au rayon, dans cette limite (une position à 180 m ± 40 m passe). */
export const GPS_ACCURACY_TOLERANCE_METERS = 50;
/** L10 : au-delà de cette précision, la position n'est pas fiable (« À vérifier »). */
export const GPS_MAX_ACCURACY_METERS = 150;
/** R7 : la distance gardée dans la preuve est arrondie à la dizaine de mètres. */
export function roundDistance(meters: number): number {
  return Math.round(meters / 10) * 10;
}
/** Délai après la fin prévue avant de passer « À vérifier » sans check-out. */
export const VISIT_GRACE_MINUTES = 120;
export const PROOF_THRESHOLD = 2;

export type ProofFactorState = { factor: ProofFactor; valid: boolean };

export type VisitProofSummary = {
  score: number;
  validFactors: ProofFactor[];
  missingFactors: ProofFactor[];
  isProven: boolean;
};

const ALL_FACTORS: ProofFactor[] = ["GPS", "CODE_DOMICILE", "CONFIRMATION_AINE"];

/** Compte les facteurs valides (un facteur compte une seule fois). */
export function computeVisitProof(factors: ProofFactorState[]): VisitProofSummary {
  const valid = new Set<ProofFactor>();
  for (const f of factors) if (f.valid) valid.add(f.factor);
  const validFactors = ALL_FACTORS.filter((f) => valid.has(f));
  return {
    score: validFactors.length,
    validFactors,
    missingFactors: ALL_FACTORS.filter((f) => !valid.has(f)),
    isProven: validFactors.length >= PROOF_THRESHOLD,
  };
}

export type VisitTiming = {
  checkInAt: Date | null;
  checkOutAt: Date | null;
  scheduledEnd: Date;
  /** Lot A2 : écart d'horloge > 12 h détecté sur un événement de l'app (null ou absent sinon). */
  clockSkewAt?: Date | null;
  /** L1-B (P1/P8) : check-in reçu plus de 30 min après l'heure de l'appareil (null ou absent sinon). */
  lateCheckInAt?: Date | null;
  /** L1d (D4) : la famille employeur a contesté une « Présence probable » (null ou absent sinon). */
  contestedAt?: Date | null;
};

/** L1d (D4) : délai de contestation d'une « Présence probable » par la famille employeur, après le check-in. */
export const CONTESTATION_HOURS = 48;

export type DeriveOptions = {
  /**
   * L1d (D4, sécurité M3) : QR et position viennent du même téléphone. En mode lancement, ils donnent seulement
   * PRESENCE_PROBABLE ; VALIDEE exige la confirmation de l'aîné (facteur CONFIRMATION_AINE).
   */
  requireElderConfirmation?: boolean;
};

/**
 * Statut de la visite :
 * - VALIDEE dès que 2 facteurs sur 3 sont valides ;
 * - PREVUE tant qu'il n'y a pas de check-in (et que le délai n'est pas dépassé) ;
 * - EN_COURS après le check-in, avant le check-out ;
 * - A_VERIFIER après le check-out (ou le délai) avec moins de 2 facteurs.
 * Une confirmation tardive de l'aîné peut faire passer A_VERIFIER → VALIDEE.
 * Lot A2 : écart d'horloge > 12 h sur un événement de l'app → A_VERIFIER tant que l'aîné n'a pas confirmé
 * (le GPS et le code viennent de l'appareil, dont l'heure n'est pas fiable).
 */
export function deriveVisitStatus(timing: VisitTiming, proof: VisitProofSummary, now: Date = new Date(), options: DeriveOptions = {}): VisitStatus {
  const confirmed = proof.validFactors.includes("CONFIRMATION_AINE");
  if ((timing.clockSkewAt || timing.lateCheckInAt || timing.contestedAt) && !confirmed) return "A_VERIFIER";
  if (proof.isProven) return options.requireElderConfirmation && !confirmed ? "PRESENCE_PROBABLE" : "VALIDEE";
  const overdue = now.getTime() > timing.scheduledEnd.getTime() + VISIT_GRACE_MINUTES * 60_000;
  if (timing.checkOutAt) return "A_VERIFIER";
  if (timing.checkInAt) return overdue ? "A_VERIFIER" : "EN_COURS";
  return overdue ? "A_VERIFIER" : "PREVUE";
}

/**
 * L1d (D4) : la famille employeur peut contester une « Présence probable » pendant 48 h après le check-in
 * (après l'heure prévue s'il n'y a pas de check-in). Une seule contestation.
 */
export function contestationOpen(
  visit: { status: VisitStatus; checkInAt: Date | null; scheduledStart: Date; contestedAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (visit.status !== "PRESENCE_PROBABLE" || visit.contestedAt) return false;
  const from = (visit.checkInAt ?? visit.scheduledStart).getTime();
  return now.getTime() <= from + CONTESTATION_HOURS * 3_600_000;
}

/** Distance en mètres entre deux points (formule de haversine). */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GpsFailure = "TROP_LOIN" | "PRECISION_FAIBLE" | "SIMULEE" | "DOMICILE_APPROXIMATIF";
export type GpsEvaluation = { valid: boolean; distanceMeters: number; reason?: GpsFailure };

/** Raison d'un échec de position, en français simple (affichée à l'accompagnant et à la famille). */
export const GPS_FAILURE_MESSAGES: Record<GpsFailure, string> = {
  TROP_LOIN: "Position trop loin du domicile.",
  PRECISION_FAIBLE: "Position trop imprécise.",
  SIMULEE: "Position simulée par le téléphone : elle n'est pas acceptée.",
  DOMICILE_APPROXIMATIF: "L'adresse du domicile est approximative : la position ne peut pas être comparée.",
};

/**
 * L10 : position du check-in comparée au domicile.
 * - position simulée (`mocked` Android) → refusée ;
 * - domicile approximatif (centre de commune) → non comparable ;
 * - précision > 150 m → trop imprécise ;
 * - distance ≤ 150 m + min(précision, 50 m) → valide.
 * Distance renvoyée ARRONDIE à la dizaine de mètres (R7).
 */
export function evaluateGps(
  position: { lat: number; lng: number; accuracy?: number | null; mocked?: boolean },
  home: { lat: number; lng: number; approximate?: boolean },
): GpsEvaluation {
  const raw = haversineMeters(position, home);
  const distanceMeters = roundDistance(raw);
  if (position.mocked) return { valid: false, distanceMeters, reason: "SIMULEE" };
  if (home.approximate) return { valid: false, distanceMeters, reason: "DOMICILE_APPROXIMATIF" };
  if (position.accuracy != null && position.accuracy > GPS_MAX_ACCURACY_METERS) {
    return { valid: false, distanceMeters, reason: "PRECISION_FAIBLE" };
  }
  const tolerance = Math.min(position.accuracy ?? 0, GPS_ACCURACY_TOLERANCE_METERS);
  if (raw > GPS_RADIUS_METERS + tolerance) return { valid: false, distanceMeters, reason: "TROP_LOIN" };
  return { valid: true, distanceMeters };
}

/** Alphabet sans caractères ambigus (pas de 0/O, 1/I/L). */
export const HOME_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const HOME_CODE_LENGTH = 6;

/** Génère un code domicile. `random` est injectable pour les tests. */
export function generateHomeCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < HOME_CODE_LENGTH; i++) {
    out += HOME_CODE_ALPHABET[Math.floor(random() * HOME_CODE_ALPHABET.length)] ?? "A";
  }
  return out;
}

/** Normalise une saisie : majuscules, sans espace ni tiret. */
export function normalizeHomeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

/** Compare la saisie au code attendu (comparaison à temps constant). */
export function verifyHomeCode(input: string, expected: string): boolean {
  const a = normalizeHomeCode(input);
  const b = normalizeHomeCode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
