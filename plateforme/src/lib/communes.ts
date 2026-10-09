/**
 * Compatibilité (T1) : la source unique est `src/lib/territoires.ts`.
 * Les fonctions de recherche couvrent TOUS les territoires (codes uniques). Les codes de Martinique ne changent pas.
 * Les listes « à choisir » (formulaires) ne contiennent que les communes des territoires OUVERTS.
 */
import {
  CODES_COMMUNES_OUVERTES,
  TERRITOIRES_OUVERTS,
  communeLabel,
  communesDe,
  getCommune,
  type Commune,
} from "@/lib/territoires";

export type { Commune };
export { getCommune, communeLabel };

/** Communes des territoires OUVERTS (Guadeloupe au lancement), dans l'ordre alphabétique. */
export const COMMUNES: readonly Commune[] = TERRITOIRES_OUVERTS.flatMap((t) => communesDe(t)).sort((a, b) => a.label.localeCompare(b.label, "fr"));

/** Codes des communes des territoires OUVERTS. */
export const COMMUNE_CODES = CODES_COMMUNES_OUVERTES;

/** Le code est une commune connue (tous territoires). */
export function isCommuneCode(code: string): boolean {
  return getCommune(code) !== undefined;
}
