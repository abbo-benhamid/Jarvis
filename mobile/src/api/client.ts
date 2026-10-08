import type { DemandeOrientation as ReponsesOrientation, EtatVerification, ResultatOrientation } from '@/contracts';
import type { HorsLigneVue } from '@/offline';
import type {
  DemandeAdresse,
  DemandeVisio,
  DossierVerification,
  ReponseAdresse,
  ReponseCodeTelephone,
  ReponseConfirmationTelephone,
  ReponseDocument,
  ReponseEntreprise,
  ReponseRecours,
  ReponseSessionIdentite,
  ReponseVisio,
  TypeDocument,
} from '@/contracts';
import type { CanalCode, FichierChoisi } from '@/compte/verifications';

/** L2 : motifs de recours (liste fermée du contrat). */
export type MotifRecours = 'ERREUR_SUR_UN_DOCUMENT' | 'NOUVEAU_DOCUMENT' | 'SITUATION_CHANGEE' | 'AUTRE';
/** L2 : décisions de la page simulée du prestataire (mêmes 4 cas que `/verification/simulee` du site). */
export type DecisionIdentiteSimulee = 'APPROUVE' | 'REFUSE' | 'A_REPRENDRE' | 'NOM_DIFFERENT';
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
 * | lireVerification     | GET  /accompagnant/verification (D15)          |
 * | envoyerOrientation   | POST /accompagnant/orientation (D15)           |
 * | demanderVerification | POST /accompagnant/verification (D15)          |
 * | lireDossier          | GET  /accompagnant/verifications (L2)          |
 * | envoyerCodeTelephone | POST …/verifications/telephone/code (L2)       |
 * | confirmerTelephone   | POST …/verifications/telephone/confirmer (L2)  |
 * | ouvrirSessionIdentite| POST …/verifications/identite/session (L2)     |
 * | demanderVisio        | POST …/verifications/identite/visio (L2)       |
 * | declarerAdresse      | POST …/verifications/adresse (L2)              |
 * | verifierEntreprise   | POST …/verifications/entreprise (L2)           |
 * | envoyerDocument      | POST /accompagnant/documents (L2, multipart)   |
 * | soumettreDossier     | POST …/verifications/soumettre (L2)            |
 * | demanderRecours      | POST …/verifications/recours (L2)              |
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

  /**
   * D15 : orientation et demande de vérification, dans l'app (profil pas encore validé).
   * Route absente sur un serveur plus ancien : `ApiError('INTROUVABLE')`, l'écran propose alors le site.
   */
  lireVerification(): Promise<EtatVerification>;
  envoyerOrientation(reponses: ReponsesOrientation): Promise<ResultatOrientation>;
  /** Envoie la demande. Après seulement, l'équipe a le dossier et appelle l'accompagnante. */
  demanderVerification(): Promise<EtatVerification>;

  /**
   * L2 : vérification (contrat `src/contracts/verifications.ts`).
   * Route absente sur un serveur plus ancien : `ApiError('INTROUVABLE')`, l'écran garde le parcours D15 seul.
   * Aucune photo de pièce d'identité ne passe par l'app : l'identité se fait sur la page du prestataire.
   */
  lireDossier(): Promise<DossierVerification>;
  /** Code à 6 chiffres par SMS ou par appel vocal. Le serveur normalise le numéro. */
  envoyerCodeTelephone(telephone: string, canal: CanalCode): Promise<ReponseCodeTelephone>;
  confirmerTelephone(challengeId: string, code: string): Promise<ReponseConfirmationTelephone>;
  /** Session chez le prestataire, après le consentement explicite à la biométrie. */
  ouvrirSessionIdentite(): Promise<ReponseSessionIdentite>;
  /** Repli humain : visio avec l'équipe, à la place du prestataire. */
  demanderVisio(demande: DemandeVisio): Promise<ReponseVisio>;
  declarerAdresse(adresse: DemandeAdresse): Promise<ReponseAdresse>;
  verifierEntreprise(siret: string): Promise<ReponseEntreprise>;
  /** Envoie un justificatif (multipart). L'app ne garde pas le fichier après l'envoi. */
  envoyerDocument(type: TypeDocument, fichier: FichierChoisi): Promise<ReponseDocument>;
  /** Envoie le dossier à l'équipe. `ELEMENTS_MANQUANTS` s'il manque une étape. */
  soumettreDossier(): Promise<void>;
  demanderRecours(motif: MotifRecours): Promise<ReponseRecours>;
  /** Mode simulé SEULEMENT : remplace la page du prestataire (aucun serveur, aucune page à ouvrir). */
  readonly simulation?: { decisionIdentite(decision: DecisionIdentiteSimulee): Promise<void> };

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
