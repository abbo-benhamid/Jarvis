/**
 * Libellés français des enums Prisma. Un terme = un sens (STE).
 * Importable côté client ET serveur (aucune dépendance serveur).
 */
import type {
  Appetite,
  CaregiverStatus,
  CaregiverValidation,
  Channel,
  Frequency,
  NeedType,
  Plan,
  ProposalStatus,
  RequestStatus,
  Role,
  TimeSlot,
  VerificationStatus,
  VerificationType,
  VisitStatus,
  ProofFactor,
  FamilyLocation,
  EmployerType,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  FAMILLE: "Famille",
  ACCOMPAGNANT: "Accompagnant",
  OPERATEUR: "Opérateur Koudmen",
};

export const ROLE_HOME: Record<Role, string> = {
  FAMILLE: "/famille",
  ACCOMPAGNANT: "/accompagnant",
  OPERATEUR: "/operateur",
};

export const FAMILY_LOCATION_LABELS: Record<FamilyLocation, string> = {
  MARTINIQUE: "En Martinique",
  HEXAGONE: "Dans l'Hexagone",
  AUTRE: "Ailleurs",
};

export const LEVEL_LABELS: Record<number, string> = {
  1: "Niveau 1 — Lien",
  2: "Niveau 2 — Coups de main",
  3: "Niveau 3 — Présence et autonomie",
  4: "Niveau 4 — Aide renforcée",
};

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Appel, visite de courtoisie, promenade, lecture.",
  2: "Courses, repas, papiers à domicile, numérique.",
  3: "Compagnie régulière, aide au repas, rendez-vous, sorties.",
  4: "Toilette, transferts, nuits. Professionnel diplômé ou SAAD.",
};

export const NEED_LABELS: Record<NeedType, string> = {
  COMPAGNIE: "Compagnie",
  APPEL_REGULIER: "Appel régulier",
  COURSES: "Courses",
  REPAS: "Repas",
  DEMARCHES: "Démarches administratives",
  NUMERIQUE: "Aide au numérique",
  SORTIES: "Sorties, promenades",
  RENDEZ_VOUS: "Accompagnement aux rendez-vous",
  AIDE_LEVER: "Aide au lever (sans transfert)",
  AIDE_RENFORCEE: "Aide renforcée (toilette, transferts)",
};

export const CAREGIVER_STATUS_LABELS: Record<CaregiverStatus, string> = {
  // m7 et A11 : formules neutres (femme ou homme), sans sigle sauf CESU et SAAD (glossaire).
  SALARIE_FAMILLE_CESU: "Payé par la famille, avec le CESU",
  AUTO_ENTREPRENEUR_SAP: "Micro-entreprise de services à la personne",
  PROCHE_AIDANT_APA: "Proche de l'aîné, payé avec l'aide autonomie",
  BENEVOLE_ASSO: "Bénévole via une association",
  SAAD: "Structure partenaire (SAAD)",
};

/** Qui emploie l'accompagnant (D6). */
export const EMPLOYER_TYPE_LABELS: Record<EmployerType, string> = {
  AINE: "L'aîné lui-même",
  REPRESENTANT: "Un représentant de l'aîné (enfant, tuteur…)",
};

export const VALIDATION_LABELS: Record<CaregiverValidation, string> = {
  BROUILLON: "Profil incomplet",
  EN_ATTENTE: "En attente de vérification",
  VALIDE: "Validé (vérifications déclarées, test)",
  REFUSE: "Refusé",
  SUSPENDU: "Suspendu",
};

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  IDENTITE: "Pièce d'identité",
  CASIER_B3: "Extrait de casier judiciaire",
  REFERENCES: "Deux références",
  FORMATION: "Formation Koudmen",
  STATUT_PRO: "Preuve de votre statut (numéro d'entreprise ou service d'aide)",
  PSC1: "Formation aux premiers secours",
  DIPLOME: "Diplôme d'aide à la personne",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  A_FOURNIR: "À fournir",
  DECLARE: "Déclaré",
  VALIDE: "Validé",
  REFUSE: "Refusé",
};

export const SLOT_LABELS: Record<TimeSlot, string> = {
  MATIN: "Matin",
  APRES_MIDI: "Après-midi",
  SOIR: "Soir",
};

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  PONCTUELLE: "Une fois",
  HEBDOMADAIRE: "Une fois par semaine",
  DEUX_PAR_SEMAINE: "Deux fois par semaine",
  QUOTIDIENNE: "Tous les jours",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  OUVERTE: "Ouverte",
  PROPOSEE: "Profils proposés",
  POURVUE: "Accompagnant trouvé",
  ANNULEE: "Annulée",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  PROPOSEE_FAMILLE: "Profil proposé à la famille",
  EN_ATTENTE: "Choisi par la famille, en attente de réponse",
  ACCEPTEE: "Acceptée",
  REFUSEE: "Refusée",
  ANNULEE: "Annulée",
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  PREVUE: "Prévue",
  EN_COURS: "En cours",
  VALIDEE: "Validée",
  A_VERIFIER: "À vérifier",
};

export const PROOF_FACTOR_LABELS: Record<ProofFactor, string> = {
  GPS: "Position à l'arrivée",
  CODE_DOMICILE: "Code du domicile",
  CONFIRMATION_AINE: "Confirmation de l'aîné",
};

/**
 * V1c (arbitrage X4, UX M4) : UN seul vocabulaire des preuves, web et app.
 * Compteur unique : « 1 preuve sur 3 », « 2 preuves sur 3 ». Il en faut 2.
 */
export function proofCountLabel(n: number): string {
  return `${n} ${n > 1 ? "preuves" : "preuve"} sur 3`;
}

/** États d'une preuve (X4) : obtenue, à faire (visite pas finie), non obtenue (visite finie ou refus). */
export const PROOF_STATE_LABELS = { OBTENUE: "Obtenue", A_FAIRE: "À faire", NON_OBTENUE: "Non obtenue" } as const;

/**
 * Échelle d'humeur (X4, UX M5) : la même sur le web et dans l'app, du mieux au moins bien
 * (ordre d'affichage : 5 → 1). Valeurs stockées inchangées (1 à 5).
 */
export const MOOD_LABELS: Record<number, string> = {
  5: "Très bien",
  4: "Bien",
  3: "Correct",
  2: "Pas très bien",
  1: "Pas bien",
};
/** Ordre d'affichage de l'humeur : du mieux au moins bien. */
export const MOOD_ORDER = [5, 4, 3, 2, 1] as const;

export const APPETITE_LABELS: Record<Appetite, string> = {
  BON: "Bon",
  MOYEN: "Moyen",
  FAIBLE: "Faible",
  NON_OBSERVE: "Non observé",
};

export const ACTIVITY_SUGGESTIONS = [
  "Discussion",
  "Promenade",
  "Lecture",
  "Jeux de société",
  "Courses",
  "Repas partagé",
  "Appel vidéo avec la famille",
  "Aide au téléphone",
  "Jardin",
  "Musique",
] as const;

export const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  VOIX: "Appel vocal",
  PUSH: "Push",
};

export const PLAN_LABELS: Record<Plan, string> = {
  LAKOU: "Libre",
  KOZE: "Kozé",
  SERENITE: "Sérénité",
};
