import type { HorsLigneVue } from '@/offline';
import type {
  BrouillonKaye,
  DemandeInscription,
  EtatTrajetServeur,
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

/** L1 : preuve d'arrivée. QR signé et/ou code (secours) et/ou position unique avec accord. */
export type PreuveArrivee = { qr?: string; codeDomicile?: string; position?: PositionPonctuelle };

/** L1 : une position du trajet (déjà arrondie par l'app). */
export type PositionTrajet = { latitude: number; longitude: number; precisionMetres: number; survenuA: string; simulee?: boolean };

/**
 * Interface unique entre les écrans et le serveur.
 *
 * Les écrans n'appellent QUE cette interface. Deux implémentations :
 * - `http.ts` (lot M2, par défaut) : routes `/api/v1` de `plateforme/` (docs/tech/api-v1.md) ;
 * - `simule.ts` (lot M1) : données en mémoire, pour les tests hors ligne (`EXPO_PUBLIC_API_MODE=simule`).
 *
 * | Méthode              | Route v1                                       |
 * |----------------------|------------------------------------------------|
 * | inscrire             | POST /auth/inscription (L1, sans connexion)    |
 * | motDePasseOublie     | POST /auth/mot-de-passe-oublie (L1)            |
 * | connecter            | POST /auth/code (PKCE S256) puis /auth/token   |
 * | restaurer            | POST /auth/refresh (jeton du stockage sûr)     |
 * | moi                  | GET  /me                                       |
 * | deconnecter          | POST /auth/logout                              |
 * | listerVisites        | GET  /visites?jours=7                          |
 * | lireVisite           | GET  /visites/{id}                             |
 * | checkIn … sos        | POST /evenements (un `clientEventId` unique)   |
 * | demarrer/arreterTrajet | POST /visites/{id}/trajet (L1)               |
 * | envoyerPosition      | POST /visites/{id}/position (L1, hors file)    |
 * | listerPropositions   | GET  /propositions                             |
 * | accepter / refuser   | POST /propositions/{id}/accepter / refuser     |
 * | enregistrerAppareil  | POST /appareils (lot N1, push)                 |
 * | retirerAppareil      | DELETE /appareils/{id}                         |
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

  /**
   * L1 : crée un compte accompagnant. Réponse identique si l'e-mail existe déjà (pas de fuite).
   * L'accompagnant reçoit un lien de vérification par e-mail.
   */
  inscrire(demande: Omit<DemandeInscription, 'role'>): Promise<void>;
  /** L1 : envoie un lien de nouveau mot de passe (1 h). Répond toujours pareil. */
  motDePasseOublie(email: string): Promise<void>;

  /** E-mail et mot de passe. Les jetons vont dans le stockage sûr de l'appareil. */
  connecter(email: string, motDePasse: string): Promise<Moi>;
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
  checkIn(visiteId: string, preuve: PreuveArrivee): Promise<ResultatEvenement>;
  /** Check-out : aucune position. */
  checkOut(visiteId: string): Promise<ResultatEvenement>;
  enregistrerBrouillonKaye(visiteId: string, brouillon: BrouillonKaye): Promise<ResultatEvenement>;
  publierKaye(visiteId: string, kaye: KayePublie): Promise<ResultatEvenement>;
  /** Alerte l'équipe Koudmen. Aucune position. Le résultat porte la `consigne` à afficher. */
  sos(visiteId?: string): Promise<ResultatEvenement>;

  /**
   * L1 (L6) : l'accompagnant démarre LUI-MÊME le partage du trajet, après son accord.
   * Fin : arrivée (check-in), arrêt, 60 min, ou moins de 150 m du domicile.
   */
  demarrerTrajet(visiteId: string): Promise<EtatTrajetServeur>;
  arreterTrajet(visiteId: string): Promise<EtatTrajetServeur>;
  /**
   * L1 : une position du trajet. JAMAIS mise en file hors ligne (seule la dernière compte) :
   * sans réseau, l'appel échoue (`RESEAU`) et l'app attend la position suivante.
   * `CONFLIT` (409) : plus de trajet en cours côté serveur.
   */
  envoyerPosition(visiteId: string, position: PositionTrajet): Promise<void>;

  listerPropositions(): Promise<Proposition[]>;
  accepterProposition(id: string): Promise<ReponseAcceptation>;
  /** Refus SANS PÉNALITÉ. La note n'est jamais transmise à la famille. */
  refuserProposition(id: string, note?: string): Promise<ReponseRefus>;

  /** Lot N1 : enregistre le jeton Expo Push de l'appareil (POST /appareils). Renvoie l'id à garder. */
  enregistrerAppareil(jeton: string, plateforme: 'IOS' | 'ANDROID'): Promise<{ id: string }>;
  /** Lot N1 : retire l'appareil (DELETE /appareils/{id}), avant la déconnexion. */
  retirerAppareil(id: string): Promise<void>;
}
