/**
 * Preuve de visite « 2 facteurs sur 3 » (docs/00, docs/05). Fonctions PURES.
 *  (a) GPS : UNE position au check-in, consentie. Jamais de suivi continu.
 *  (b) Code domicile : 6 caractères affichés sur la fiche aîné (remplace QR/NFC).
 *  (c) Confirmation de l'aîné : appel vocal « tapez 1 » (simulé dans le MVP).
 */
import type { ProofFactor, VisitStatus } from "@prisma/client";

/** Rayon autour du domicile pour valider le GPS. [À VÉRIFIER] avec le terrain (relief, précision). */
export const GPS_RADIUS_METERS = 300;
/** Au-delà de cette précision, la position n'est pas fiable. */
export const GPS_MAX_ACCURACY_METERS = 500;
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
};

/**
 * Statut de la visite :
 * - VALIDEE dès que 2 facteurs sur 3 sont valides ;
 * - PREVUE tant qu'il n'y a pas de check-in (et que le délai n'est pas dépassé) ;
 * - EN_COURS après le check-in, avant le check-out ;
 * - A_VERIFIER après le check-out (ou le délai) avec moins de 2 facteurs.
 * Une confirmation tardive de l'aîné peut faire passer A_VERIFIER → VALIDEE.
 */
export function deriveVisitStatus(timing: VisitTiming, proof: VisitProofSummary, now: Date = new Date()): VisitStatus {
  if (proof.isProven) return "VALIDEE";
  const overdue = now.getTime() > timing.scheduledEnd.getTime() + VISIT_GRACE_MINUTES * 60_000;
  if (timing.checkOutAt) return "A_VERIFIER";
  if (timing.checkInAt) return overdue ? "A_VERIFIER" : "EN_COURS";
  return overdue ? "A_VERIFIER" : "PREVUE";
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

export type GpsEvaluation = { valid: boolean; distanceMeters: number; reason?: "TROP_LOIN" | "PRECISION_FAIBLE" };

export function evaluateGps(
  position: { lat: number; lng: number; accuracy?: number | null },
  home: { lat: number; lng: number },
): GpsEvaluation {
  const distanceMeters = Math.round(haversineMeters(position, home));
  if (position.accuracy != null && position.accuracy > GPS_MAX_ACCURACY_METERS) {
    return { valid: false, distanceMeters, reason: "PRECISION_FAIBLE" };
  }
  if (distanceMeters > GPS_RADIUS_METERS) return { valid: false, distanceMeters, reason: "TROP_LOIN" };
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
