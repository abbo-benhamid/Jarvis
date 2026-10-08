/**
 * Formats français, sans dépendre de `Intl` (support variable selon le moteur JS).
 * Typographie (§ 4) : espace insécable entre nombre et unité, espace fine avant « : ».
 */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const NBSP = ' ';
export const NNBSP = ' ';

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const deux = (n: number) => String(n).padStart(2, '0');

/**
 * Revue L1 D16 : les heures de visite sont TOUJOURS dites à l'heure de Martinique (UTC−4, pas d'heure d'été),
 * même si le téléphone est réglé sur un autre fuseau (accompagnante en voyage, test). Sans `Intl`.
 */
export const DECALAGE_MARTINIQUE_MIN = -240;

type Parties = { annee: number; mois: number; date: number; jour: number; h: number; m: number };

/** Date et heure à la Martinique (lues en UTC après le décalage fixe). */
export function enMartinique(iso: string | Date): Parties {
  const t = (typeof iso === 'string' ? new Date(iso) : iso).getTime() + DECALAGE_MARTINIQUE_MIN * 60_000;
  const d = new Date(t);
  return { annee: d.getUTCFullYear(), mois: d.getUTCMonth(), date: d.getUTCDate(), jour: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes() };
}

/** Le téléphone n'est PAS à l'heure de Martinique : on ajoute l'heure locale du lecteur. */
export function horsFuseauMartinique(maintenant: Date = new Date()): boolean {
  return -maintenant.getTimezoneOffset() !== DECALAGE_MARTINIQUE_MIN;
}

const texteHeure = (h: number, m: number) => (m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${deux(m)}`);

/** « 9 h 58 », « 10 h », heure de Martinique. Un seul format partout (revue UX m7 : plus de « 09:58 »). */
export function heureTexte(iso: string): string {
  const p = enMartinique(iso);
  return texteHeure(p.h, p.m);
}

/** « 9 h 58 » à l'heure du TÉLÉPHONE (« chez vous », quand le fuseau diffère). */
export function heureLocale(iso: string): string {
  const d = new Date(iso);
  return texteHeure(d.getHours(), d.getMinutes());
}

/** « 10 h – 12 h ». */
export function plageHoraire(debut: string, fin: string): string {
  return `${heureTexte(debut)} – ${heureTexte(fin)}`;
}

/** D16 : « 10 h – 12 h, heure de Martinique », plus « (14 h – 16 h chez vous) » si le téléphone est sur un autre fuseau. */
export function plageAvecFuseau(debut: string, fin: string, maintenant: Date = new Date()): string {
  const base = `${plageHoraire(debut, fin)}, heure de Martinique`;
  return horsFuseauMartinique(maintenant) ? `${base} (${heureLocale(debut)} – ${heureLocale(fin)} chez vous)` : base;
}

/** « Jeudi 8 octobre » (jour à la Martinique). */
export function dateLongue(iso: string | Date): string {
  const p = enMartinique(iso);
  return `${majuscule(JOURS[p.jour] ?? '')} ${p.date} ${MOIS[p.mois] ?? ''}`;
}

/** Abréviation du jour pour une pastille de date : « JEU ». */
export function jourCourt(iso: string): string {
  return (JOURS[enMartinique(iso).jour] ?? '').slice(0, 3).toUpperCase();
}

/** Numéro du jour à la Martinique : « 8 ». */
export function numeroJour(iso: string): number {
  return enMartinique(iso).date;
}

/** Même jour à la Martinique. */
export function memeJour(a: string | Date, b: string | Date): boolean {
  const x = enMartinique(a);
  const y = enMartinique(b);
  return x.annee === y.annee && x.mois === y.mois && x.date === y.date;
}

/** « Aujourd'hui », « Demain » ou « Samedi 10 octobre ». */
export function libelleJour(iso: string, maintenant: Date = new Date()): string {
  if (memeJour(iso, maintenant)) return 'Aujourd’hui';
  if (memeJour(iso, new Date(maintenant.getTime() + 24 * 3600_000))) return 'Demain';
  return dateLongue(iso);
}

/** « 18,00 € ». */
export function euros(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace('.', ',')}${NBSP}€`;
}

/** « 2 visites », « 1 visite », « 2 nouvelles propositions » (chaque mot s'accorde ; revue UX m2). */
export function pluriel(n: number, mots: string): string {
  return `${n}${NBSP}${n > 1 ? mots.split(' ').map((m) => `${m}s`).join(' ') : mots}`;
}
