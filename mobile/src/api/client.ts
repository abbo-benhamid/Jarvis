import type { HorsLigneVue } from '@/offline';
import type {
  BrouillonKaye,
  KayePublie,
  Moi,
  PositionPonctuelle,
  Proposition,
  ReponseAcceptation,
  ReponseRefus,
  ReponseVisite,
  ResultatEvenement,
  Visite,
} from './types';

/**
 * Interface unique entre les écrans et le serveur.
 *
 * Les écrans n'appellent QUE cette interface. Deux implémentations :
 * - `http.ts` (lot M2, par défaut) : routes `/api/v1` de `plateforme/` (docs/tech/api-v1.md) ;
 * - `simule.ts` (lot M1) : données en mémoire, pour la démo hors ligne (`EXPO_PUBLIC_API_MODE=simule`).
 *
 * | Méthode              | Route v1                                       |
 * |----------------------|------------------------------------------------|
 * | connecter            | POST /auth/code (PKCE S256) puis /auth/token   |
 * | connecterDemo        | idem, `methode: "demo"` (DEMO_MODE=true)       |
 * | restaurer            | POST /auth/refresh (jeton du stockage sûr)     |
 * | moi                  | GET  /me                                       |
 * | deconnecter          | POST /auth/logout                              |
 * | listerVisites        | GET  /visites?jours=7                          |
 * | lireVisite           | GET  /visites/{id}                             |
 * | checkIn … sos        | POST /evenements (un `clientEventId` unique)   |
 * | listerPropositions   | GET  /propositions                             |
 * | accepter / refuser   | POST /propositions/{id}/accepter / refuser     |
 */
export interface KoudmenApi {
  readonly mode: 'http' | 'simule';
  /** URL de l'API (mode http), pour l'affichage dans Profil. */
  readonly url: string | null;
  /**
   * Lot M3 : file d'événements et cache hors ligne (mode http seulement).
   * Absent en mode simulé (pas de réseau à attendre).
   */
  readonly horsLigne?: HorsLigneVue;

  /** E-mail et mot de passe. Les jetons vont dans le stockage sûr de l'appareil. */
  connecter(email: string, motDePasse: string): Promise<Moi>;
  /** Compte de démonstration partagé (serveur en DEMO_MODE seulement). */
  connecterDemo(): Promise<Moi>;
  /** Au démarrage : reprend la connexion gardée sur l'appareil. `null` si aucune. */
  restaurer(): Promise<Moi | null>;
  moi(): Promise<Moi>;
  /** Ferme la connexion de l'appareil. Efface toujours les jetons locaux, même hors réseau. */
  deconnecter(): Promise<void>;
  /** Appelé quand la connexion est perdue (jeton révoqué ou réutilisé). Renvoie la fonction de désabonnement. */
  surSessionPerdue(cb: (message: string) => void): () => void;

  /** Visites des 7 prochains jours (et des 12 dernières heures), triées par heure de début. */
  listerVisites(): Promise<Visite[]>;
  lireVisite(id: string): Promise<ReponseVisite>;

  /**
   * Check-in : code du domicile et/ou position PONCTUELLE (une lecture, avec accord).
   * Lève une `ApiError` si le serveur refuse l'événement.
   *
   * Lot M3 (les 5 actions ci-dessous) : l'événement passe par la file hors ligne.
   * Sans réseau : `ApiError('EN_ATTENTE')`, l'événement reste gardé et part au retour du réseau.
   */
  checkIn(visiteId: string, preuve: { codeDomicile?: string; position?: PositionPonctuelle }): Promise<ResultatEvenement>;
  /** Check-out : aucune position. */
  checkOut(visiteId: string): Promise<ResultatEvenement>;
  enregistrerBrouillonKaye(visiteId: string, brouillon: BrouillonKaye): Promise<ResultatEvenement>;
  publierKaye(visiteId: string, kaye: KayePublie): Promise<ResultatEvenement>;
  /** Alerte l'équipe Koudmen. Aucune position. Le résultat porte la `consigne` à afficher. */
  sos(visiteId?: string): Promise<ResultatEvenement>;

  listerPropositions(): Promise<Proposition[]>;
  accepterProposition(id: string): Promise<ReponseAcceptation>;
  /** Refus SANS PÉNALITÉ. La note n'est jamais transmise à la famille. */
  refuserProposition(id: string, note?: string): Promise<ReponseRefus>;
}
