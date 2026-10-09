/**
 * P1 : espace famille et espace accompagnant en PRÉINSCRIPTION (R1 : aucune donnée sur le parent).
 * Fonctions PURES (client et serveur), testées dans `preinscription.test.ts`.
 */

/** Une place dans une file : identifiant et date d'entrée. */
export type EntreeFile = { id: string; depuis: Date };

/** Ordre de la file : la date d'entrée, puis l'identifiant (deux entrées à la même milliseconde gardent un ordre stable). */
export function compareFile(a: EntreeFile, b: EntreeFile): number {
  const d = a.depuis.getTime() - b.depuis.getTime();
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Rang (1 = premier) de `id` dans la file. Null si `id` n'est pas dans la file. */
export function rangDansFile(file: readonly EntreeFile[], id: string): number | null {
  const moi = file.find((e) => e.id === id);
  if (!moi) return null;
  return file.filter((e) => compareFile(e, moi) < 0).length + 1;
}

/** Rang à partir du nombre d'entrées placées avant (requête `count` en base). */
export function rangDepuisCompte(avant: number): number {
  return Math.max(0, Math.floor(avant)) + 1;
}

/** « n° 12 » (espace insécable). */
export function libelleRang(rang: number): string {
  return `n° ${rang}`;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;

/**
 * Date d'ouverture visée (variable `OUVERTURE_PREVUE`) : `AAAA-MM` ou `AAAA-MM-JJ`.
 * Renvoie « en mars 2027 » ou « le 15 mars 2027 ». Null si la valeur est absente, invalide ou déjà passée :
 * l'interface dit alors « bientôt » (jamais une date fausse).
 */
export function ouverturePrevue(raw: string | null | undefined, now: Date = new Date()): string | null {
  const v = raw?.trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = m[3] ? Number(m[3]) : null;
  if (month < 1 || month > 12) return null;
  if (day !== null) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    // Passée : le jour est fini partout (marge de 14 h pour les fuseaux d'outre-mer).
    if (d.getTime() + 38 * 3_600_000 < now.getTime()) return null;
    return `le ${day === 1 ? "1er" : day} ${MOIS[month - 1]} ${year}`;
  }
  // Mois passé : la fin du mois est dépassée.
  if (Date.UTC(year, month, 1) + 14 * 3_600_000 < now.getTime()) return null;
  return `en ${MOIS[month - 1]} ${year}`;
}

/** Phrase d'ouverture : « Ouverture prévue en mars 2027. » ou « Ouverture : bientôt. » */
export function phraseOuverture(raw: string | null | undefined, now: Date = new Date()): string {
  const quand = ouverturePrevue(raw, now);
  return quand ? `Ouverture prévue ${quand}.` : "Ouverture : bientôt.";
}

// ─────────────────────────────── « Préparer l'arrivée » (liste locale) ───────────────────────────────

/**
 * Liste de vérification de la famille. Gardée dans le navigateur seulement (localStorage), jamais sur le serveur.
 * Des cases à cocher, aucun champ libre : la famille n'écrit rien sur son parent (R1).
 */
export const PREPARER_ITEMS = [
  { id: "accord", title: "Parlez de Koudmen à votre parent", text: "Son accord compte. Avant toute visite, un conseiller l'appelle pour le lui demander." },
  { id: "telephone", title: "Gardez le numéro de votre parent", text: "Fixe ou portable. Le conseiller en a besoin pour l'appeler." },
  { id: "confiance", title: "Choisissez une personne de confiance sur place", text: "Un voisin, un cousin. Elle peut ouvrir la porte ou aider en cas de besoin." },
  { id: "habitudes", title: "Pensez à ses habitudes", text: "Les bonnes heures pour une visite, ce qu'il aime faire, ce qu'il n'aime pas." },
  { id: "famille", title: "Parlez du budget en famille", text: "Qui paie, quelle formule. Les heures d'accompagnement ouvrent un crédit d'impôt si les conditions sont remplies." },
] as const;

export type PreparerId = (typeof PREPARER_ITEMS)[number]["id"];

/** Clé du stockage local (versionnée : une nouvelle liste = une nouvelle clé). */
export const PREPARER_STORAGE_KEY = "koudmen.preparer-arrivee.v1";

const PREPARER_IDS = new Set<string>(PREPARER_ITEMS.map((i) => i.id));

/** Lit la valeur stockée. Toute valeur abîmée ou inconnue donne une liste vide (jamais d'erreur). */
export function lireCoches(raw: string | null | undefined): PreparerId[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is PreparerId => typeof x === "string" && PREPARER_IDS.has(x)))];
  } catch {
    return [];
  }
}

/** « 2 sur 5 prêts » */
export function libelleAvancement(faits: number, total: number = PREPARER_ITEMS.length): string {
  if (faits >= total) return "Tout est prêt";
  return `${faits} sur ${total} ${faits > 1 ? "prêts" : "prêt"}`;
}
