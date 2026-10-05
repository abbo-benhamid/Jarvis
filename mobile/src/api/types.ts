/**
 * Types du domaine vus par l'app accompagnant (lot M2).
 *
 * Ils viennent des contrats Zod de l'API v1 (`src/contracts/`, copie générée de
 * `plateforme/src/contracts/v1/**` par `scripts/sync-contracts.mjs`). Ne pas les redéfinir ici.
 *
 * RGPD (ADR 0008 § 4 règle 2) : l'app garde le minimum. Pas de téléphone de l'aîné,
 * pas de code du domicile, pas d'historique de Kayé, pas de donnée de santé.
 */
import type { CodeErreur, MotifRefus } from '@/contracts';

export type {
  BrouillonKaye,
  FacteurPreuve,
  KayePublie,
  Proposition,
  ReponseAcceptation,
  ReponseMoi as Moi,
  ReponseRefus,
  ReponseVisite,
  ResultatEvenement,
  StatutVisite,
  Visite,
} from '@/contracts';
export { SEUIL_PREUVE } from '@/contracts';

/** Deux facteurs de preuve sur trois valident une visite. */
export { SEUIL_PREUVE as PREUVES_REQUISES } from '@/contracts';

/** Position ponctuelle lue au check-in, avec l'accord explicite de l'accompagnant. */
export type PositionPonctuelle = { latitude: number; longitude: number; precisionMetres?: number };

/** Codes d'erreur de l'app : codes de l'API, motifs de refus d'un événement, erreurs locales. */
export type CodeErreurApp =
  | CodeErreur
  | MotifRefus
  /** Le serveur ne répond pas (réseau coupé, URL fausse, CORS). */
  | 'RESEAU'
  /** La réponse ne respecte pas le contrat (versions différentes). */
  | 'REPONSE_INVALIDE'
  /** La position ne peut pas être lue (refus, appareil sans GPS). */
  | 'POSITION_INDISPONIBLE'
  /** Lot M3 : pas de réseau, l'événement est gardé dans la file hors ligne. Il part tout seul au retour du réseau. */
  | 'EN_ATTENTE';

/** Erreur unique de l'app. Le `message` est en français simple : il s'affiche tel quel. */
export class ApiError extends Error {
  constructor(
    public readonly code: CodeErreurApp,
    message: string,
    /** Statut HTTP (0 si pas de réponse). */
    public readonly statut = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Message affichable pour toute erreur (une erreur inconnue donne un message générique). */
export function messageErreur(e: unknown, repli = 'Le service ne répond pas. Réessayez.'): string {
  return e instanceof ApiError ? e.message : repli;
}
