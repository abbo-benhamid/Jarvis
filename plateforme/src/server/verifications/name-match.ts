/**
 * L2 (étude § 3.2, § 6.4) : comparaison des noms et des adresses. Fonctions PURES.
 * Normalisation : majuscules, sans accent, tirets et apostrophes = espace, espaces unifiés.
 * Une différence ne refuse jamais : elle met l'élément « à revoir » ou demande un document (revue humaine).
 */

/** « Marie-Josée  d'Arbaud » → « MARIE JOSEE D ARBAUD ». */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[-'’‐–.,]/g, " ")
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(raw: string | null | undefined): string[] {
  return normalizeName(raw).split(" ").filter((t) => t.length > 0);
}

export type PersonName = { givenNames: string; familyName: string };

/**
 * Même personne ? Nom de famille : égal après normalisation, ou l'un contient l'autre (nom composé, nom d'usage).
 * Prénoms : le premier prénom de l'un figure dans les prénoms de l'autre.
 */
export function personNamesMatch(a: PersonName, b: PersonName): boolean {
  const fa = normalizeName(a.familyName);
  const fb = normalizeName(b.familyName);
  if (!fa || !fb) return false;
  const famTa = nameTokens(fa);
  const famTb = nameTokens(fb);
  const familyOk = fa === fb || famTa.every((t) => famTb.includes(t)) || famTb.every((t) => famTa.includes(t));
  if (!familyOk) return false;
  const ga = nameTokens(a.givenNames);
  const gb = nameTokens(b.givenNames);
  if (ga.length === 0 || gb.length === 0) return false;
  return gb.includes(ga[0]!) || ga.includes(gb[0]!);
}

/**
 * Nom du registre (entrepreneur individuel) : soit des champs séparés, soit un nom complet (« BELLEMARE JOSIANE »).
 * Le nom complet est accepté si tous les mots du nom de famille et le premier prénom y figurent.
 */
export function registryNameMatches(person: PersonName, registry: { givenNames?: string; familyName?: string; fullName?: string }): boolean {
  if (registry.familyName) return personNamesMatch(person, { givenNames: registry.givenNames ?? "", familyName: registry.familyName });
  const full = nameTokens(registry.fullName);
  if (full.length === 0) return false;
  const fam = nameTokens(person.familyName);
  const given = nameTokens(person.givenNames);
  return fam.length > 0 && given.length > 0 && fam.every((t) => full.includes(t)) && full.includes(given[0]!);
}

const STREET_WORDS: Record<string, string> = {
  R: "RUE",
  AV: "AVENUE",
  AVE: "AVENUE",
  BD: "BOULEVARD",
  BLD: "BOULEVARD",
  CHE: "CHEMIN",
  CH: "CHEMIN",
  RTE: "ROUTE",
  IMP: "IMPASSE",
  LOT: "LOTISSEMENT",
  LOTISS: "LOTISSEMENT",
  RES: "RESIDENCE",
  RESID: "RESIDENCE",
  QRT: "QUARTIER",
  QUART: "QUARTIER",
  PL: "PLACE",
  ALL: "ALLEE",
  ST: "SAINT",
  STE: "SAINTE",
};

/** « 12, r. des Flamboyants » → « 12 RUE DES FLAMBOYANTS ». */
export function normalizeStreet(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => STREET_WORDS[w] ?? w)
    .join(" ");
}

/** Étude § 3.2.6 : même code postal + même voie après normalisation. */
export function addressesMatch(a: { line: string; postalCode: string }, b: { line: string; postalCode: string }): boolean {
  if (a.postalCode.trim() !== b.postalCode.trim()) return false;
  const la = normalizeStreet(a.line);
  const lb = normalizeStreet(b.line);
  return la.length > 0 && (la === lb || la.endsWith(lb) || lb.endsWith(la));
}
