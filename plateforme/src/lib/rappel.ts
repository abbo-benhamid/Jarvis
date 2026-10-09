/**
 * L1d (M4) : créneaux de rappel par un conseiller. Fonctions PURES (client et serveur).
 * T1 (T4) : le conseiller travaille dans le territoire de l'équipe (Guadeloupe au lancement). Les heures des créneaux
 * sont dans SON fuseau IANA. La famille de la diaspora lit aussi l'heure de Paris : l'écart est calculé pour la date
 * du jour (heure d'été comprise), jamais en dur.
 */
import { hoursBetween } from "@/lib/fuseau";
import { TERRITOIRE_LANCEMENT, territoire, type CodeTerritoire } from "@/lib/territoires";

export const CRENEAUX = ["MATIN", "MIDI", "APRES_MIDI"] as const;
export type Creneau = (typeof CRENEAUX)[number];

/** Territoire de l'équipe Koudmen (conseillers, visios) : le territoire de lancement. */
export const TERRITOIRE_EQUIPE: CodeTerritoire = TERRITOIRE_LANCEMENT;

/** Heures de début et de fin, heure du territoire de l'équipe. */
export const CRENEAU_HEURES: Record<Creneau, [number, number]> = {
  MATIN: [8, 11],
  MIDI: [11, 14],
  APRES_MIDI: [14, 17],
};

/** Sujet d'une demande de rappel : une formule payante, ou une simple question (sans formule). */
export const SUJETS_RAPPEL = ["KOZE", "SERENITE", "QUESTION"] as const;
export type SujetRappel = (typeof SUJETS_RAPPEL)[number];

/** Décalage de Paris par rapport à l'UTC (1 ou 2) à une date donnée. */
export function parisOffset(d: Date): number {
  return hoursBetween("UTC", "Europe/Paris", d);
}

const h = (n: number) => {
  const whole = ((Math.floor(n) % 24) + 24) % 24;
  const min = Math.round((n - Math.floor(n)) * 60);
  return min === 0 ? `${whole} h` : `${whole} h ${String(min).padStart(2, "0")}`;
};

/** « 8 h – 11 h en Guadeloupe (14 h – 17 h à Paris) ». */
export function creneauLabel(c: Creneau, now: Date = new Date(), equipe: CodeTerritoire = TERRITOIRE_EQUIPE): string {
  const [a, b] = CRENEAU_HEURES[c];
  const t = territoire(equipe);
  const shift = hoursBetween(t.fuseau, "Europe/Paris", now);
  if (shift === 0) return `${h(a)} – ${h(b)} ${t.enNom}`;
  return `${h(a)} – ${h(b)} ${t.enNom} (${h(a + shift)} – ${h(b + shift)} à Paris)`;
}

/** Libellé court pour l'opérateur (heure du territoire de l'équipe). */
export function creneauLabelOperateur(c: string | null | undefined, equipe: CodeTerritoire = TERRITOIRE_EQUIPE): string {
  if (!c || !(c in CRENEAU_HEURES)) return "créneau non précisé";
  const [a, b] = CRENEAU_HEURES[c as Creneau];
  return `${h(a)} – ${h(b)} (${territoire(equipe).libelleHeure})`;
}
