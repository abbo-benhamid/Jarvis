/**
 * Territoires (T1) : configuration et règles de choix.
 *
 * ```mermaid
 * flowchart LR
 *   V[Visite / proposition] -->|territoire du serveur| T[Territoire]
 *   V -->|sinon : fuseau IANA| T
 *   V -->|sinon : code de commune| T
 *   V -->|sinon| L[Territoire de lancement : Guadeloupe]
 *   T --> F[Fuseau, nom, communes, carte]
 * ```
 */
import { ORDRE_TERRITOIRES, TERRITOIRE_LANCEMENT, TERRITOIRES } from './donnees';
import { CODES_TERRITOIRE, type ChampsTerritoire, type CodeTerritoire, type Commune, type Territoire } from './types';

export * from './types';
export { libelleHeureFuseau, ORDRE_TERRITOIRES, TERRITOIRE_LANCEMENT, TERRITOIRES } from './donnees';

export function estCodeTerritoire(x: unknown): x is CodeTerritoire {
  return typeof x === 'string' && (CODES_TERRITOIRE as readonly string[]).includes(x);
}

/** Territoire d'un code. Code absent ou inconnu : territoire de lancement. */
export function territoire(code?: string | null): Territoire {
  return TERRITOIRES[estCodeTerritoire(code) ? code : TERRITOIRE_LANCEMENT];
}

export const territoireLancement = (): Territoire => TERRITOIRES[TERRITOIRE_LANCEMENT];
export const estOuvert = (code: CodeTerritoire) => TERRITOIRES[code].etat === 'OUVERT';

/** Commune d'un territoire (les codes sont uniques DANS un territoire seulement). */
export function trouverCommune(code: string, territoireCode: CodeTerritoire = TERRITOIRE_LANCEMENT): Commune | undefined {
  return TERRITOIRES[territoireCode].communes.find((c) => c.code === code);
}

type AvecTerritoire = ChampsTerritoire & { aine?: ChampsTerritoire & { commune?: string | null } };

/**
 * Territoire d'une visite ou d'une proposition.
 * Ordre : champ `territoire` du serveur (visite, puis aîné), puis fuseau IANA, puis commune (territoires ouverts
 * d'abord), puis territoire de lancement.
 */
export function territoireDe(x: AvecTerritoire): Territoire {
  if (estCodeTerritoire(x.territoire)) return TERRITOIRES[x.territoire];
  if (estCodeTerritoire(x.aine?.territoire)) return TERRITOIRES[x.aine.territoire];
  const fuseau = x.fuseau ?? x.aine?.fuseau;
  if (fuseau) {
    const parFuseau = ORDRE_TERRITOIRES.find((c) => TERRITOIRES[c].fuseau === fuseau);
    if (parFuseau) return TERRITOIRES[parFuseau];
  }
  const commune = x.aine?.commune;
  if (commune) {
    const ordre = [...ORDRE_TERRITOIRES].sort((a, b) => Number(estOuvert(b)) - Number(estOuvert(a)));
    const parCommune = ordre.find((c) => trouverCommune(commune, c));
    if (parCommune) return TERRITOIRES[parCommune];
  }
  return territoireLancement();
}

/** Fuseau IANA d'une visite : celui du serveur, sinon celui de son territoire. */
export function fuseauDe(x: AvecTerritoire): string {
  const f = x.fuseau ?? x.aine?.fuseau;
  return typeof f === 'string' && f.length > 0 ? f : territoireDe(x).fuseau;
}

/** Territoire du compte connecté (champ provisoire `territoire` de GET /me), sinon territoire de lancement. */
export function territoireCompte(moi: object | null | undefined): Territoire {
  const code = (moi as { territoire?: unknown } | null | undefined)?.territoire;
  return territoire(estCodeTerritoire(code) ? code : null);
}

/** Texte « Bientôt » d'un territoire pas encore ouvert (phrases courtes, voix active). */
export function explicationBientot(code: CodeTerritoire): string {
  const t = TERRITOIRES[code];
  const l = territoireLancement();
  return `Koudmen ouvre d’abord ${l.enNom}. Les visites ${t.enNom} arrivent plus tard. Inscrivez-vous sur la liste d’attente : nous vous prévenons à l’ouverture.`;
}
