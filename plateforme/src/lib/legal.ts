/**
 * Constantes légales du MVP. UNE seule source pour tout le code (client et serveur).
 * ATTENTION : à mettre à jour à chaque revalorisation. Vérifie la valeur avant le pilote.
 */

/**
 * SMIC horaire brut au 1er janvier 2026, en centimes.
 * [À VÉRIFIER] 12,02 € (revalorisation du 1er janvier 2026). Source : décret annuel SMIC.
 */
export const SMIC_HORAIRE_BRUT_CENTS = 1202;

/**
 * Salaire horaire brut minimum de la convention collective des particuliers employeurs
 * (IDCC 3239), niveau le plus bas, en centimes.
 * [À VÉRIFIER] Le minimum conventionnel du niveau A est aligné sur le SMIC quand il lui est inférieur.
 */
export const IDCC_3239_MIN_HORAIRE_BRUT_CENTS = 1202;

/** Plancher du tarif d'un accompagnant salarié (D10) : le plus haut des deux minimums. */
export const PLANCHER_SALARIE_CENTS = Math.max(SMIC_HORAIRE_BRUT_CENTS, IDCC_3239_MIN_HORAIRE_BRUT_CENTS);

/** Numéros d'urgence affichés près du signal « à surveiller » (T10). */
export const URGENCES = "Urgence : 15 ou 112. Maltraitance : 3977.";
