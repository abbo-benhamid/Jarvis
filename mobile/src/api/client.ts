import type { KayeBrouillon, PreuveType, Session, Visite } from './types';

/**
 * Interface unique entre les écrans et le serveur.
 *
 * Les écrans n'appellent QUE cette interface. Deux implémentations :
 * - `simule.ts` (lot M1) : données en mémoire, latence courte ;
 * - `http.ts` (lot M2) : routes `/api/v1` de `plateforme/` (ADR 0008 § 3).
 *
 * Correspondance prévue avec l'API v1 :
 * | Méthode            | Route v1                                   |
 * |--------------------|--------------------------------------------|
 * | demanderCode       | POST /api/v1/auth/code                     |
 * | connecter          | POST /api/v1/auth/token                    |
 * | deconnecter        | POST /api/v1/auth/logout                   |
 * | listerVisites      | GET  /api/v1/visites?jours=7               |
 * | lireVisite         | GET  /api/v1/visites/{id}                  |
 * | ajouterPreuve      | POST /api/v1/visites/{id}/evenements       |
 * | enregistrerKaye    | POST /api/v1/visites/{id}/evenements       |
 */
export interface KoudmenApi {
  /** Envoie un code à 6 chiffres par SMS. */
  demanderCode(telephone: string): Promise<void>;
  /** Échange le code contre une session. */
  connecter(telephone: string, code: string): Promise<Session>;
  deconnecter(): Promise<void>;

  /** Visites des 7 prochains jours, triées par heure de début. */
  listerVisites(): Promise<Visite[]>;
  lireVisite(id: string): Promise<Visite>;

  /**
   * Enregistre une preuve d'arrivée.
   * POSITION : une seule lecture, après accord, jamais en arrière-plan (ADR 0008 § 4 règle 1).
   */
  ajouterPreuve(visiteId: string, type: PreuveType, donnees?: { code?: string }): Promise<Visite>;

  lireBrouillonKaye(visiteId: string): Promise<KayeBrouillon>;
  enregistrerKaye(brouillon: KayeBrouillon, envoyer: boolean): Promise<void>;
}
