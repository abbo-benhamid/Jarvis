import type { Moi } from '@/api/types';

/**
 * État du compte après la connexion (L1, § 2.1 et décisions de l'orchestrateur).
 *
 * | État             | Condition (GET /me)          | Écran                                   |
 * |------------------|------------------------------|-----------------------------------------|
 * | `preinscription` | `preinscription: true`       | « Koudmen ouvre bientôt en Martinique » |
 * | `validation`     | `profilValide: false`        | « Profil en cours de validation »       |
 * | `actif`          | sinon                        | Visites (rappel si e-mail non vérifié)  |
 *
 * Un serveur d'avant L1 (champs absents) donne `actif` : l'app ne bloque pas un compte existant.
 */
export type EtatCompte = 'preinscription' | 'validation' | 'actif';

export function etatCompte(moi: Pick<Moi, 'preinscription' | 'profilValide'>): EtatCompte {
  if (moi.preinscription === true) return 'preinscription';
  if (moi.profilValide === false) return 'validation';
  return 'actif';
}

/** Rappel « Vérifiez votre e-mail » : seulement si le serveur dit explicitement `false`. */
export function emailAVerifier(moi: Pick<Moi, 'emailVerifie'>): boolean {
  return moi.emailVerifie === false;
}
