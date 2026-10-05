/**
 * Types du domaine vus par l'app accompagnant.
 *
 * PROVISOIRE : au lot M2, ces types viennent de `src/contracts/` (copie générée des
 * schémas Zod de `plateforme/src/contracts/v1/**`, ADR 0008 § 3). Gardez les noms
 * proches de la spécification V1 (§ 10 et API § 1220) pour limiter le travail de M2.
 *
 * RGPD (ADR 0008 § 4 règle 2) : l'app garde le minimum. Pas de téléphone de l'aîné,
 * pas d'historique de Kayé, pas de donnée de santé.
 */

export type Accompagnant = {
  id: string;
  prenom: string;
  nom: string;
  commune: string;
  /** Tarif horaire fixé par l'accompagnant (anti-requalification, ADR 0008 § 4). */
  tarifHoraireCentimes: number;
  statut: 'AUTO_ENTREPRENEUR' | 'CESU' | 'BENEVOLE';
};

export type Session = {
  accompagnant: Accompagnant;
  /** Jeton simulé. M2 : jeton d'accès 15 min + renouvellement 30 jours dans expo-secure-store. */
  jeton: string;
};

export type Aine = {
  prenom: string;
  nom: string;
  quartier: string;
  commune: string;
  /** Centres d'intérêt, pour ouvrir la conversation. */
  gouts: string[];
};

export type PreuveType = 'POSITION' | 'CODE' | 'CONFIRMATION_AINE';

export type Preuve = {
  type: PreuveType;
  /** ISO 8601. Absent si la preuve n'est pas encore obtenue. */
  obtenueA?: string;
  /** POSITION : distance arrondie au domicile, en mètres (spéc. R4). */
  distanceArrondieM?: number;
};

export type VisiteStatut = 'A_VENIR' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';

export type Visite = {
  id: string;
  aine: Aine;
  /** ISO 8601. */
  debut: string;
  fin: string;
  statut: VisiteStatut;
  /** Ce que la famille demande pour cette visite. */
  consigne: string;
  /** Indication d'accès (où se trouve le code du domicile). */
  acces: string;
  /** Temps de trajet estimé, en minutes (simulé). */
  trajetMin: number;
  preuves: Preuve[];
  kayeEnvoye: boolean;
};

/** Il faut 2 preuves sur 3 pour valider une visite (spéc. § preuve de visite). */
export const PREUVES_REQUISES = 2;

export type Humeur = 'BIEN' | 'CALME' | 'FATIGUEE' | 'TRISTE';
export type Appetit = 'BON' | 'MOYEN' | 'FAIBLE';

export type KayeBrouillon = {
  visiteId: string;
  humeur: Humeur | null;
  appetit: Appetit | null;
  note: string;
  aSurveiller: boolean;
  /** Obligatoire si `aSurveiller` : ce que l'accompagnant a vu. */
  aSurveillerDetail: string;
};

/** Erreur unique de l'API (même forme que le futur format d'erreur v1). */
export class ApiError extends Error {
  constructor(
    public readonly code: 'CODE_INVALIDE' | 'NON_CONNECTE' | 'INTROUVABLE' | 'INVALIDE' | 'RESEAU',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
