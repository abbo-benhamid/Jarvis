import type { Moi } from '@/api/types';

/**
 * État du compte après la connexion (L1, § 2.1 et décisions de l'orchestrateur).
 *
 * | État             | Condition (GET /me)                         | Écran                                          |
 * |------------------|---------------------------------------------|------------------------------------------------|
 * | `validation`     | `profilValide: false`                       | « Profil en cours de validation » (D15)        |
 * | `preinscription` | `profilValide: true`, `preinscription: true`| « Koudmen ouvre bientôt en Martinique »        |
 * | `actif`          | sinon                                       | Visites (rappel si e-mail non vérifié)         |
 *
 * Revue UX M14 / D15 : un profil à valider suit TOUJOURS le même parcours (orientation, demande de vérification),
 * même en préinscription. L'écran de validation montre alors aussi « Koudmen ouvre bientôt ».
 *
 * Le contrat `/me` rend ces champs obligatoires. Absents (valeur inconnue) : `actif`, l'app ne bloque pas.
 */
export type EtatCompte = 'preinscription' | 'validation' | 'actif';

export function etatCompte(moi: Partial<Pick<Moi, 'preinscription' | 'profilValide'>>): EtatCompte {
  if (moi.profilValide === false) return 'validation';
  if (moi.preinscription === true) return 'preinscription';
  return 'actif';
}

/** Rappel « Vérifiez votre e-mail » : seulement si le serveur dit explicitement `false`. */
export function emailAVerifier(moi: Partial<Pick<Moi, 'emailVerifie'>>): boolean {
  return moi.emailVerifie === false;
}
