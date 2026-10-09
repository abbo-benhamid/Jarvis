/**
 * Formats français, sans dépendre de `Intl` pour les fuseaux connus (support variable selon le moteur JS).
 * Typographie (§ 4) : espace insécable entre nombre et unité, espace fine avant « : ».
 */
import { libelleHeureFuseau } from '../territoires/donnees';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const NBSP = ' ';
export const NNBSP = ' ';

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const deux = (n: number) => String(n).padStart(2, '0');

/**
 * Revue L1 D16, puis T1 (arbitrage T4) : une heure de visite est dite à l'heure du TERRITOIRE de la visite
 * (fuseau IANA : `America/Guadeloupe`, `America/Martinique`, `America/Cayenne`, `Europe/Paris`), même si le
 * téléphone est réglé sur un autre fuseau. L'heure du téléphone s'ajoute quand elle diffère.
 *
 * Sans `Intl` pour les fuseaux connus (Expo Go, moteur JS variable) :
 * - Antilles et Guyane : décalage fixe, pas d'heure d'été.
 * - Europe/Paris : règle de l'Union européenne (dernier dimanche de mars et d'octobre, à 1 h UTC).
 * Fuseau inconnu : `Intl` si possible, sinon le fuseau de lancement.
 */
export const FUSEAU_DEFAUT = 'America/Guadeloupe';

/** Décalages fixes (minutes à ajouter à l'heure UTC). */
const DECALAGES_FIXES: Record<string, number> = {
  'America/Guadeloupe': -240,
  'America/Martinique': -240,
  'America/Cayenne': -180,
  'Indian/Reunion': 240,
  'Indian/Mayotte': 180,
  UTC: 0,
  'Etc/UTC': 0,
};

/** Jour (1 à 31) du dernier dimanche d'un mois (mois de 0 à 11). */
function dernierDimanche(annee: number, mois: number): number {
  const dernier = new Date(Date.UTC(annee, mois + 1, 0));
  return dernier.getUTCDate() - dernier.getUTCDay();
}

/** Heure d'été de l'Union européenne : du dernier dimanche de mars au dernier dimanche d'octobre, 1 h UTC. */
function heureEteEurope(t: number): boolean {
  const annee = new Date(t).getUTCFullYear();
  const debut = Date.UTC(annee, 2, dernierDimanche(annee, 2), 1);
  const fin = Date.UTC(annee, 9, dernierDimanche(annee, 9), 1);
  return t >= debut && t < fin;
}

function decalageIntl(fuseau: string, t: number): number | null {
  try {
    const parties = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(new Date(t));
    const v = (type: string) => Number(parties.find((p) => p.type === type)?.value);
    const local = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'));
    const arrondi = Math.floor(t / 60_000) * 60_000;
    return Number.isFinite(local) ? Math.round((local - arrondi) / 60_000) : null;
  } catch {
    return null;
  }
}

/** Décalage d'un fuseau IANA par rapport à UTC, en minutes, à un instant donné (heure d'été comprise). */
export function decalageMinutes(fuseau: string, instant: string | Date | number = Date.now()): number {
  const t = typeof instant === 'number' ? instant : (typeof instant === 'string' ? new Date(instant) : instant).getTime();
  const fixe = DECALAGES_FIXES[fuseau];
  if (fixe !== undefined) return fixe;
  if (fuseau === 'Europe/Paris') return heureEteEurope(t) ? 120 : 60;
  return decalageIntl(fuseau, t) ?? -240;
}

/** Décalage du TÉLÉPHONE (fuseau du système), ou d'un fuseau IANA donné (tests). */
function decalageTelephone(instant: Date, fuseauTelephone?: string): number {
  return fuseauTelephone ? decalageMinutes(fuseauTelephone, instant) : -instant.getTimezoneOffset();
}

type Parties = { annee: number; mois: number; date: number; jour: number; h: number; m: number };

/** Date et heure dans un fuseau (lues en UTC après le décalage). */
export function dansFuseau(iso: string | Date, fuseau: string = FUSEAU_DEFAUT): Parties {
  const t0 = (typeof iso === 'string' ? new Date(iso) : iso).getTime();
  const d = new Date(t0 + decalageMinutes(fuseau, t0) * 60_000);
  return { annee: d.getUTCFullYear(), mois: d.getUTCMonth(), date: d.getUTCDate(), jour: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes() };
}

/** Le téléphone n'est PAS à l'heure du territoire à cet instant : on ajoute l'heure du téléphone. */
export function horsFuseau(fuseau: string = FUSEAU_DEFAUT, instant: Date = new Date(), fuseauTelephone?: string): boolean {
  return decalageTelephone(instant, fuseauTelephone) !== decalageMinutes(fuseau, instant);
}

const texteHeure = (h: number, m: number) => (m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${deux(m)}`);

/** « 9 h 58 », « 10 h », heure du territoire. Un seul format partout (revue UX m7 : plus de « 09:58 »). */
export function heureTexte(iso: string, fuseau: string = FUSEAU_DEFAUT): string {
  const p = dansFuseau(iso, fuseau);
  return texteHeure(p.h, p.m);
}

/** « 9 h 58 » à l'heure du TÉLÉPHONE (« chez vous », quand le fuseau diffère). */
export function heureLocale(iso: string, fuseauTelephone?: string): string {
  if (fuseauTelephone) return heureTexte(iso, fuseauTelephone);
  const d = new Date(iso);
  return texteHeure(d.getHours(), d.getMinutes());
}

/** « 10 h – 12 h ». */
export function plageHoraire(debut: string, fin: string, fuseau: string = FUSEAU_DEFAUT): string {
  return `${heureTexte(debut, fuseau)} – ${heureTexte(fin, fuseau)}`;
}

/**
 * D16, T4 : « 10 h – 12 h, heure de Guadeloupe », plus « (16 h – 18 h chez vous) » si le téléphone est sur un
 * autre fuseau au début de la visite. `fuseauTelephone` : pour les tests seulement (sinon, le fuseau du système).
 */
export function plageAvecFuseau(debut: string, fin: string, fuseau: string = FUSEAU_DEFAUT, fuseauTelephone?: string): string {
  const base = `${plageHoraire(debut, fin, fuseau)}, ${libelleHeureFuseau(fuseau)}`;
  return horsFuseau(fuseau, new Date(debut), fuseauTelephone)
    ? `${base} (${heureLocale(debut, fuseauTelephone)} – ${heureLocale(fin, fuseauTelephone)} chez vous)`
    : base;
}

/** « Jeudi 8 octobre » (jour dans le fuseau du territoire). */
export function dateLongue(iso: string | Date, fuseau: string = FUSEAU_DEFAUT): string {
  const p = dansFuseau(iso, fuseau);
  return `${majuscule(JOURS[p.jour] ?? '')} ${p.date} ${MOIS[p.mois] ?? ''}`;
}

/** Abréviation du jour pour une pastille de date : « JEU ». */
export function jourCourt(iso: string, fuseau: string = FUSEAU_DEFAUT): string {
  return (JOURS[dansFuseau(iso, fuseau).jour] ?? '').slice(0, 3).toUpperCase();
}

/** Numéro du jour dans le fuseau du territoire : « 8 ». */
export function numeroJour(iso: string, fuseau: string = FUSEAU_DEFAUT): number {
  return dansFuseau(iso, fuseau).date;
}

/** Même jour dans le fuseau du territoire. */
export function memeJour(a: string | Date, b: string | Date, fuseau: string = FUSEAU_DEFAUT): boolean {
  const x = dansFuseau(a, fuseau);
  const y = dansFuseau(b, fuseau);
  return x.annee === y.annee && x.mois === y.mois && x.date === y.date;
}

/** « Aujourd'hui », « Demain » ou « Samedi 10 octobre » (jours du territoire). */
export function libelleJour(iso: string, maintenant: Date = new Date(), fuseau: string = FUSEAU_DEFAUT): string {
  if (memeJour(iso, maintenant, fuseau)) return 'Aujourd’hui';
  if (memeJour(iso, new Date(maintenant.getTime() + 24 * 3600_000), fuseau)) return 'Demain';
  return dateLongue(iso, fuseau);
}

/** « 18,00 € ». */
export function euros(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace('.', ',')}${NBSP}€`;
}

/** « 2 visites », « 1 visite », « 2 nouvelles propositions » (chaque mot s'accorde ; revue UX m2). */
export function pluriel(n: number, mots: string): string {
  return `${n}${NBSP}${n > 1 ? mots.split(' ').map((m) => `${m}s`).join(' ') : mots}`;
}
