/**
 * L1d (M4) : créneaux de rappel par un conseiller. Fonctions PURES (client et serveur).
 * Le conseiller travaille en Martinique (UTC−4, sans heure d'été). La famille de la diaspora lit aussi l'heure de Paris
 * (+6 h en été, +5 h en hiver) : le décalage est calculé pour la date du jour.
 */

export const CRENEAUX = ["MATIN", "MIDI", "APRES_MIDI"] as const;
export type Creneau = (typeof CRENEAUX)[number];

/** Heures de début et de fin, heure de Martinique. */
export const CRENEAU_HEURES: Record<Creneau, [number, number]> = {
  MATIN: [8, 11],
  MIDI: [11, 14],
  APRES_MIDI: [14, 17],
};

/** Sujet d'une demande de rappel : une formule payante, ou une simple question (sans formule). */
export const SUJETS_RAPPEL = ["KOZE", "SERENITE", "QUESTION"] as const;
export type SujetRappel = (typeof SUJETS_RAPPEL)[number];

const MARTINIQUE_OFFSET = -4;

/** Décalage de Paris par rapport à l'UTC (1 ou 2) à une date donnée. */
export function parisOffset(d: Date): number {
  // formatToParts : le format « 14 h » du français ne se convertit pas en nombre.
  const part = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).formatToParts(d).find((p) => p.type === "hour");
  const h = Number(part?.value ?? d.getUTCHours() + 1);
  return (((h - d.getUTCHours()) % 24) + 24) % 24;
}

const h = (n: number) => `${((n % 24) + 24) % 24} h`;

/** « 8 h – 11 h en Martinique (14 h – 17 h à Paris) ». */
export function creneauLabel(c: Creneau, now: Date = new Date()): string {
  const [a, b] = CRENEAU_HEURES[c];
  const shift = parisOffset(now) - MARTINIQUE_OFFSET;
  return `${h(a)} – ${h(b)} en Martinique (${h(a + shift)} – ${h(b + shift)} à Paris)`;
}

/** Libellé court pour l'opérateur (heure de Martinique). */
export function creneauLabelOperateur(c: string | null | undefined): string {
  if (!c || !(c in CRENEAU_HEURES)) return "créneau non précisé";
  const [a, b] = CRENEAU_HEURES[c as Creneau];
  return `${h(a)} – ${h(b)} (heure de Martinique)`;
}
