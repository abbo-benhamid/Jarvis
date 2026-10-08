/**
 * Ajouts PROPRES À L'APP pour le lot L1 (D13, revue code m7).
 *
 * Les schémas Zod viennent TOUS de `src/contracts/` (copie générée de `plateforme/src/contracts/v1`,
 * `scripts/sync-contracts.mjs`). Ce fichier garde seulement :
 * - des constantes d'écran et de calcul local (arrivée à 150 m, arrondi, âge minimum) ;
 * - des petites fonctions de lecture (`lireControle`, `ageEnAnnees`).
 * Il ne redéfinit aucun schéma de demande ni de réponse.
 */
import type { ControleCheckIn, ReponseTrajet, ResultatEvenement } from '@/contracts';

export {
  MOT_DE_PASSE_MIN,
  TRAJET_DUREE_MAX_MIN as DUREE_MAX_TRAJET_MIN,
  TRAJET_INTERVALLE_POSITION_S as INTERVALLE_POSITION_TRAJET_S,
} from '@/contracts';

/** Âge minimum pour créer un compte accompagnant (le serveur refuse aussi sous 18 ans). */
export const AGE_MIN_ACCOMPAGNANT = 18;
/** Fin automatique du partage à moins de 150 m d'un domicile précis (contrat trajet, R4). */
export const DISTANCE_ARRIVEE_M = 150;
/** Arrondi envoyé : 3 décimales (≈ 110 m en latitude), comme le serveur. */
export const DECIMALES_POSITION_TRAJET = 3;
/** Préfixe du QR signé imprimé sur la carte domicile (L9). */
export const PREFIXE_QR_SIGNE = 'koudmen:domicile:s1:';

/** Domicile de l'aîné pour la carte d'itinéraire (réponse de DEMARRER). */
export type DomicileTrajet = NonNullable<ReponseTrajet['domicile']>;

/** Âge en années révolues à la date `maintenant` (date AAAA-MM-JJ). */
export function ageEnAnnees(dateNaissance: string, maintenant = new Date()): number {
  const [a, m, j] = dateNaissance.split('-').map(Number) as [number, number, number];
  let age = maintenant.getFullYear() - a;
  const moisJour = (maintenant.getMonth() + 1) * 100 + maintenant.getDate();
  if (moisJour < m * 100 + j) age -= 1;
  return age;
}

/** Le contrôle du check-in. `null` si le serveur n'en envoie pas (CHECK_OUT, Kayé…). */
export function lireControle(r: Pick<ResultatEvenement, 'controle'>): ControleCheckIn | null {
  return r.controle ?? null;
}
