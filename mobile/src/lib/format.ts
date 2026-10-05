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

/** « 10:00 » (chiffres tabulaires, pour une colonne ou une puce). */
export function heureCourte(iso: string): string {
  const d = new Date(iso);
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

/** « 9 h 58 », « 10 h » (dans une phrase). */
export function heureTexte(iso: string): string {
  const d = new Date(iso);
  const m = d.getMinutes();
  return m === 0 ? `${d.getHours()}${NBSP}h` : `${d.getHours()}${NBSP}h${NBSP}${deux(m)}`;
}

/** « 10 h – 12 h ». */
export function plageHoraire(debut: string, fin: string): string {
  return `${heureTexte(debut)} – ${heureTexte(fin)}`;
}

/** « Jeudi 8 octobre ». */
export function dateLongue(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${majuscule(JOURS[d.getDay()] ?? '')} ${d.getDate()} ${MOIS[d.getMonth()] ?? ''}`;
}

/** Abréviation du jour pour une pastille de date : « JEU ». */
export function jourCourt(iso: string): string {
  const d = new Date(iso);
  return (JOURS[d.getDay()] ?? '').slice(0, 3).toUpperCase();
}

export function memeJour(a: string | Date, b: string | Date): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** « Aujourd'hui », « Demain » ou « Samedi 10 octobre ». */
export function libelleJour(iso: string): string {
  const auj = new Date();
  const dem = new Date();
  dem.setDate(auj.getDate() + 1);
  if (memeJour(iso, auj)) return 'Aujourd’hui';
  if (memeJour(iso, dem)) return 'Demain';
  return dateLongue(iso);
}

/** « 18,00 € ». */
export function euros(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace('.', ',')}${NBSP}€`;
}

/** « 2 visites », « 1 visite ». */
export function pluriel(n: number, mot: string): string {
  return `${n}${NBSP}${mot}${n > 1 ? 's' : ''}`;
}
