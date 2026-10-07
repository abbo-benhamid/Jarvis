/**
 * Règle statut → niveaux autorisés (docs/08 § 3.1), en numérotation MVP 1 à 4 :
 *   MVP 1 = 08 niveau 0 « Lien »
 *   MVP 2 = 08 niveau 1 « Coups de main »
 *   MVP 3 = 08 niveau 2 « Présence et autonomie »
 *   MVP 4 = 08 niveau 3 « Aide renforcée »
 * Pur et sans dépendance serveur : importable côté client.
 */
import type { CaregiverStatus } from "@prisma/client";

export const LEVELS = [1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];

export function isLevel(n: number): n is Level {
  return (LEVELS as readonly number[]).includes(n);
}

const BASE_LEVELS: Record<CaregiverStatus, readonly Level[]> = {
  // Statut par défaut. Niveau 4 seulement avec un diplôme vérifié (DEAES, ADVF).
  SALARIE_FAMILLE_CESU: [1, 2, 3],
  // Coups de main seulement. Jamais compagnie ni présence (activités 25-27 interdites).
  // [À VÉRIFIER] avocat : niveau 1 « Lien » exclu car c'est de la compagnie.
  AUTO_ENTREPRENEUR_SAP: [2],
  // Salarié de l'aîné via l'APA (hors conjoint). Niveau 4 avec diplôme.
  PROCHE_AIDANT_APA: [1, 2, 3],
  // Lien seulement, porté par une association partenaire.
  BENEVOLE_ASSO: [1],
  // SAAD autorisé : tous les niveaux.
  SAAD: [1, 2, 3, 4],
};

export type LevelOptions = {
  /** Diplôme DEAES / ADVF VALIDÉ par l'opérateur. */
  hasDiploma?: boolean;
  /** R6 (J26) : âge de l'accompagnant, en années. Inconnu → pas de restriction d'âge (anciens profils). */
  age?: number | null;
};

/** R6 (J26, docs/08 § 4.2) : âge minimum pour accompagner. */
export const MIN_CAREGIVER_AGE = 18;
/** R6 : âge minimum pour le niveau 3 « Présence » (docs/08 niveau 2, proposition 21 ans). */
export const MIN_AGE_LEVEL_3 = 21;

/** Âge en années révolues à la date `now` (dates en UTC, comme `@db.Date`). */
export function ageInYears(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

/** Liste triée des niveaux qu'un statut peut exercer. */
export function allowedLevelsFor(status: CaregiverStatus, opts: LevelOptions = {}): Level[] {
  const base = new Set<Level>(BASE_LEVELS[status]);
  if (opts.hasDiploma && (status === "SALARIE_FAMILLE_CESU" || status === "PROCHE_AIDANT_APA")) {
    base.add(4);
  }
  // R6 : niveau 3 bloqué sous 21 ans (règle serveur).
  if (opts.age != null && opts.age < MIN_AGE_LEVEL_3) base.delete(3);
  return [...base].sort((a, b) => a - b);
}

/**
 * Règle centrale : ce statut peut-il exercer ce niveau ?
 * Exemple : un auto-entrepreneur ne peut JAMAIS être proposé pour un niveau 3 ou 4.
 */
export function canStatusDoLevel(status: CaregiverStatus, level: number, opts: LevelOptions = {}): boolean {
  if (!isLevel(level)) return false;
  return allowedLevelsFor(status, opts).includes(level);
}

/** Le statut demande-t-il un tarif horaire ? (non pour le bénévole). */
export function statusIsPaid(status: CaregiverStatus): boolean {
  return status !== "BENEVOLE_ASSO";
}
