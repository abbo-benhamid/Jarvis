/**
 * L2 (lot I1, étude § 6) : éléments requis par statut, transitions, blocage de la validation, action suivante.
 * Fonctions PURES : aucune base, aucun `server-only`. Importable côté client (écrans) et serveur.
 *
 * RÈGLES :
 * 1. Une machine ne met JAMAIS `REFUSE`. Un refus du prestataire donne `A_REVOIR` (art. 22 RGPD).
 * 2. `REFUSE` exige deux opérateurs : le premier propose, un SECOND confirme.
 * 3. La validation du dossier est bloquée tant qu'un élément obligatoire n'est pas `VALIDE`.
 * 4. Le bac à sable (monde fictif) ne demande pas les éléments L2 : aucune vraie pièce, aucun vrai téléphone.
 */
import type { CaregiverStatus, CaregiverValidation, VerificationMethod, VerificationStatus, VerificationType } from "@prisma/client";
import type { ActionSuivante, ElementVerification, MotifComplement } from "@/contracts/v1/verifications";

export const L2_TYPES = ["TELEPHONE", "IDENTITE", "ADRESSE", "ENTREPRISE"] as const satisfies readonly VerificationType[];
export type L2Type = (typeof L2_TYPES)[number];

export function isL2Type(t: VerificationType): t is L2Type {
  return (L2_TYPES as readonly string[]).includes(t);
}

/** Facultatif : le diplôme ouvre seulement le niveau 4. */
export const OPTIONAL_TYPES: readonly VerificationType[] = ["DIPLOME"];

export type L2Options = {
  /** `ADDRESS_PROOF_REQUIRED` (défaut vrai) : l'avocat peut retirer le justificatif d'adresse (étude § 4.2). */
  addressProofRequired: boolean;
};

/**
 * Étude § 6.1 : éléments L2 par statut. L'identité vient de l'orientation (déjà requise pour tous).
 * - Salarié CESU, proche aidant : téléphone, adresse.
 * - Auto-entrepreneur : téléphone, entreprise, adresse (siège Sirene, sinon justificatif).
 * - SAAD : téléphone (représentant), entreprise (siège Sirene).
 * - Bénévole : téléphone (l'association vérifie le reste).
 */
export function l2TypesFor(status: CaregiverStatus | null, opts: L2Options): L2Type[] {
  if (!status) return [];
  const out: L2Type[] = ["TELEPHONE"];
  if (status === "AUTO_ENTREPRENEUR_SAP" || status === "SAAD") out.push("ENTREPRISE");
  if (opts.addressProofRequired && (status === "SALARIE_FAMILLE_CESU" || status === "PROCHE_AIDANT_APA" || status === "AUTO_ENTREPRENEUR_SAP")) out.push("ADRESSE");
  return out;
}

/** Éléments requis (L2 + ceux de l'orientation). Le bac à sable garde les seuls éléments de l'orientation. */
export function requiredTypes(
  status: CaregiverStatus | null,
  existing: readonly VerificationType[],
  opts: L2Options & { sandbox: boolean },
): VerificationType[] {
  const base = existing.filter((t) => !isL2Type(t) || t === "IDENTITE");
  const l2 = opts.sandbox ? [] : l2TypesFor(status, opts);
  return [...new Set<VerificationType>([...base, ...l2])].filter((t) => !OPTIONAL_TYPES.includes(t));
}

// ─────────────── Transitions (étude § 6.2) ───────────────

/** Qui change l'état : le système (prestataire, registre, code), l'accompagnant, un opérateur, ou un SECOND opérateur. */
export type TransitionActor = "SYSTEME" | "ACCOMPAGNANT" | "OPERATEUR" | "SECOND_OPERATEUR";

const TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  A_FOURNIR: ["EN_COURS", "DECLARE", "A_REVOIR", "VALIDE"],
  EN_COURS: ["EN_COURS", "VALIDE", "A_REVOIR", "A_FOURNIR"],
  DECLARE: ["DECLARE", "EN_COURS", "VALIDE", "A_REVOIR", "A_FOURNIR"],
  A_REVOIR: ["A_REVOIR", "VALIDE", "A_FOURNIR", "REFUSE"],
  VALIDE: ["EXPIRE", "A_FOURNIR"],
  EXPIRE: ["A_FOURNIR", "EN_COURS", "DECLARE", "VALIDE"],
  REFUSE: ["A_FOURNIR"],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus, by: TransitionActor): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  // Règle 1 et 2 : seul un SECOND opérateur met REFUSE.
  if (to === "REFUSE") return by === "SECOND_OPERATEUR";
  // L'accompagnant ne valide jamais seul.
  if (to === "VALIDE" && by === "ACCOMPAGNANT") return false;
  // Après un refus, seul un opérateur rouvre l'élément (recours accepté).
  if (from === "REFUSE") return by === "OPERATEUR" || by === "SECOND_OPERATEUR";
  return true;
}

/** Second avis : le confirmateur d'un refus n'est jamais celui qui l'a proposé. */
export function canConfirmRefusal(proposedById: string | null, operatorId: string): boolean {
  return proposedById !== null && proposedById !== operatorId;
}

// ─────────────── Identité : traduction de la décision du prestataire (étude § 8.2) ───────────────

export type IdentityOutcome = "APPROUVE" | "REFUSE_PRESTATAIRE" | "A_REPRENDRE" | "EN_REVUE" | "ABANDONNE";

export type IdentityDecision = { status: VerificationStatus; decisionCode: MotifComplement | "RISQUE" | "MINEUR" | "COMPTE_EN_DOUBLE" | null };

export function identityItemStatus(input: {
  outcome: IdentityOutcome;
  nameMatch: boolean | null;
  birthDateMatch: boolean | null;
  adult: boolean | null;
  duplicate: boolean;
  riskCodes: readonly string[];
}): IdentityDecision {
  switch (input.outcome) {
    case "APPROUVE":
      if (input.duplicate) return { status: "A_REVOIR", decisionCode: "COMPTE_EN_DOUBLE" };
      if (input.adult === false) return { status: "A_REVOIR", decisionCode: "MINEUR" };
      if (input.nameMatch !== true) return { status: "A_REVOIR", decisionCode: "NOM_DIFFERENT" };
      if (input.birthDateMatch !== true) return { status: "A_REVOIR", decisionCode: "DATE_NAISSANCE_DIFFERENTE" };
      if (input.riskCodes.length > 0) return { status: "A_REVOIR", decisionCode: "RISQUE" };
      return { status: "VALIDE", decisionCode: null };
    case "REFUSE_PRESTATAIRE":
      // Jamais REFUSE direct.
      return { status: "A_REVOIR", decisionCode: "RISQUE" };
    case "A_REPRENDRE":
      return { status: "A_FOURNIR", decisionCode: "REPRENDRE_PHOTO" };
    case "EN_REVUE":
      return { status: "EN_COURS", decisionCode: null };
    case "ABANDONNE":
      return { status: "A_FOURNIR", decisionCode: null };
  }
}

/** Après 3 sessions sans succès : visio, pas une quatrième session payante. */
export const MAX_IDENTITY_SESSIONS = 3;

// ─────────────── Dossier (étude § 6.3, § 6.4) ───────────────

/** Un élément est « prêt » pour la demande : fait, en cours, déclaré (visio) ou en revue humaine. */
export function itemReadyForSubmission(status: VerificationStatus): boolean {
  return status !== "A_FOURNIR" && status !== "REFUSE" && status !== "EXPIRE";
}

export type ItemSnapshot = { type: VerificationType; status: VerificationStatus };

/** Éléments obligatoires absents ou pas encore prêts (demande de vérification). */
export function itemsNotReady(required: readonly VerificationType[], items: readonly ItemSnapshot[]): VerificationType[] {
  return required.filter((t) => {
    const it = items.find((i) => i.type === t);
    return !it || !itemReadyForSubmission(it.status);
  });
}

/** Éléments obligatoires absents ou pas encore VALIDE (validation définitive). */
export function itemsNotValidated(required: readonly VerificationType[], items: readonly ItemSnapshot[]): VerificationType[] {
  return required.filter((t) => items.find((i) => i.type === t)?.status !== "VALIDE");
}

/**
 * État suivant du dossier après un changement d'élément (sans décision d'opérateur sur le dossier) :
 * - A_COMPLETER → EN_ATTENTE quand tous les éléments obligatoires sont de nouveau prêts ;
 * - VALIDE → EXPIRE quand un élément obligatoire expire ;
 * - EXPIRE → VALIDE quand tous les éléments obligatoires sont de nouveau VALIDE.
 */
export function nextDossierState(current: CaregiverValidation, required: readonly VerificationType[], items: readonly ItemSnapshot[]): CaregiverValidation {
  if (current === "A_COMPLETER" && itemsNotReady(required, items).length === 0) return "EN_ATTENTE";
  if (current === "VALIDE" && items.some((i) => required.includes(i.type) && i.status === "EXPIRE")) return "EXPIRE";
  if (current === "EXPIRE" && itemsNotValidated(required, items).length === 0) return "VALIDE";
  return current;
}

/** Délai de recours après un refus (étude § 6.5). */
export const APPEAL_DAYS = 30;
/** Nouvelle demande possible après un refus confirmé. */
export const REAPPLY_MONTHS = 6;

export function appealPossible(p: { validation: CaregiverValidation; refusedAt: Date | null; openAppeal: boolean }, now: Date = new Date()): boolean {
  if (p.validation !== "REFUSE" || !p.refusedAt || p.openAppeal) return false;
  return now.getTime() - p.refusedAt.getTime() <= APPEAL_DAYS * 86_400_000;
}

/** Après un refus confirmé (L2), une nouvelle demande attend 6 mois, sauf recours accepté. Ancien refus (sans date) : libre. */
export function reapplyBlocked(p: { validation: CaregiverValidation; refusedAt: Date | null }, now: Date = new Date()): boolean {
  if (p.validation !== "REFUSE" || !p.refusedAt) return false;
  const until = new Date(p.refusedAt);
  until.setUTCMonth(until.getUTCMonth() + REAPPLY_MONTHS);
  return now < until;
}

// ─────────────── Action suivante et vue d'un élément (contrat v1) ───────────────

export const L2_LABELS: Record<VerificationType, string> = {
  TELEPHONE: "Numéro de téléphone",
  IDENTITE: "Identité",
  ADRESSE: "Adresse",
  ENTREPRISE: "Entreprise (SIRET)",
  CASIER_B3: "Extrait de casier judiciaire",
  REFERENCES: "Deux références",
  FORMATION: "Formation Koudmen",
  STATUT_PRO: "Preuve de votre statut",
  PSC1: "Formation aux premiers secours",
  DIPLOME: "Diplôme d'aide à la personne",
};

export const COMPLEMENT_LABELS: Record<MotifComplement, string> = {
  ILLISIBLE: "Le document est illisible.",
  TROP_ANCIEN: "Le document a plus de 3 mois.",
  NOM_DIFFERENT: "Le nom ne correspond pas à votre identité vérifiée.",
  ADRESSE_DIFFERENTE: "L'adresse ne correspond pas à l'adresse déclarée.",
  TYPE_NON_ACCEPTE: "Ce type de document n'est pas accepté.",
  PAGE_MANQUANTE: "Une page manque.",
  REPRENDRE_PHOTO: "Reprenez la photo de la pièce, dans un endroit bien éclairé.",
  DATE_NAISSANCE_DIFFERENTE: "La date de naissance ne correspond pas.",
};

export type ElementContext = {
  /** Adresse déclarée connue. */
  hasAddress: boolean;
  /** Document de secours demandé (entreprise : nom caché, nom différent, registre muet, ou réglage « toujours »). */
  companyDocumentRequired: boolean;
  /** SIRET contrôlé dans le registre. */
  siretChecked: boolean;
  /** Sessions d'identité encore possibles. */
  identitySessionsLeft: number;
};

export type ItemForView = {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  method: VerificationMethod | null;
  decisionCode: string | null;
  expiresAt: Date | null;
};

function isComplement(code: string | null): code is MotifComplement {
  return code !== null && code in COMPLEMENT_LABELS;
}

export function nextAction(item: ItemForView, ctx: ElementContext): ActionSuivante {
  const s = item.status;
  if (s === "VALIDE") return "AUCUNE";
  if (s === "EN_COURS" || s === "A_REVOIR" || s === "REFUSE") return "ATTENDRE";
  if (s === "DECLARE") return item.type === "CASIER_B3" || item.method === "VISIO" ? "MONTRER_EN_VISIO" : "ATTENDRE";
  // A_FOURNIR ou EXPIRE.
  switch (item.type) {
    case "TELEPHONE":
      return "VERIFIER_TELEPHONE";
    case "IDENTITE":
      return "VERIFIER_IDENTITE";
    case "ADRESSE":
      return ctx.hasAddress ? "TELEVERSER_JUSTIFICATIF" : "SAISIR_ADRESSE";
    case "ENTREPRISE":
      return ctx.siretChecked && ctx.companyDocumentRequired ? "TELEVERSER_DOCUMENT_ENTREPRISE" : "SAISIR_SIRET";
    case "CASIER_B3":
      return "MONTRER_EN_VISIO";
    default:
      return "DECLARER_SUR_LE_SITE";
  }
}

const NEUTRAL_MESSAGES: Record<ActionSuivante, string> = {
  VERIFIER_TELEPHONE: "Recevez un code par SMS ou par appel.",
  VERIFIER_IDENTITE: "Prenez en photo votre pièce d'identité, puis votre visage. Ou demandez une visio.",
  SAISIR_SIRET: "Écrivez votre numéro SIRET (14 chiffres).",
  SAISIR_ADRESSE: "Écrivez votre adresse.",
  TELEVERSER_JUSTIFICATIF: "Envoyez un justificatif de domicile de moins de 3 mois.",
  TELEVERSER_DOCUMENT_ENTREPRISE: "Envoyez un extrait Kbis, un extrait RNE ou un avis de situation Sirene de moins de 3 mois.",
  DECLARER_SUR_LE_SITE: "Déclarez ce point sur le site Koudmen.",
  MONTRER_EN_VISIO: "Montrez ce document à l'équipe pendant la visio. Koudmen ne garde pas de copie.",
  ATTENDRE: "L'équipe Koudmen vérifie. Vous n'avez rien à faire.",
  AUCUNE: "C'est vérifié.",
};

export function elementView(item: ItemForView, ctx: ElementContext): ElementVerification {
  const action = nextAction(item, ctx);
  const complement = (item.status === "A_FOURNIR" || item.status === "EXPIRE") && isComplement(item.decisionCode) ? item.decisionCode : null;
  let message = NEUTRAL_MESSAGES[action];
  if (complement) message = `${COMPLEMENT_LABELS[complement]} ${message}`;
  if (item.status === "EXPIRE") message = `Cette vérification a expiré. ${message}`;
  if (item.type === "IDENTITE" && action === "VERIFIER_IDENTITE" && ctx.identitySessionsLeft === 0) {
    message = "Vous avez fait 3 essais. Demandez une visio avec l'équipe Koudmen.";
  }
  return {
    id: item.id,
    type: item.type,
    etat: item.status,
    methode: item.method,
    obligatoire: !OPTIONAL_TYPES.includes(item.type),
    libelle: L2_LABELS[item.type],
    expireLe: item.expiresAt ? item.expiresAt.toISOString().slice(0, 10) : null,
    actionSuivante: action,
    motifComplement: complement,
    surLeSite: action === "DECLARER_SUR_LE_SITE",
    message: message.slice(0, 300),
  };
}

/** Ordre d'affichage : L2 d'abord (ce que l'app peut faire), puis les déclarations. */
export const ITEM_ORDER: readonly VerificationType[] = ["TELEPHONE", "IDENTITE", "ENTREPRISE", "ADRESSE", "CASIER_B3", "REFERENCES", "FORMATION", "STATUT_PRO", "PSC1", "DIPLOME"];

// ─────────────── Revue opérateur (étude § 4.4) ───────────────

/** Liste de contrôle du justificatif d'adresse (cases, jamais de texte libre). */
export const ADDRESS_CHECKLIST = [
  { code: "NOM_CONFORME", label: "Le nom correspond au nom vérifié." },
  { code: "ADRESSE_CONFORME", label: "L'adresse correspond à l'adresse déclarée." },
  { code: "MOINS_DE_3_MOIS", label: "Le document a moins de 3 mois (ou c'est le dernier avis d'impôt)." },
  { code: "TYPE_ACCEPTE", label: "Le document est d'un type accepté." },
  { code: "SANS_RETOUCHE", label: "Aucun signe de retouche visible (polices, alignement, montants)." },
] as const;

/** Liste de contrôle du document d'entreprise (Kbis, extrait RNE, avis Sirene). */
export const COMPANY_CHECKLIST = [
  { code: "NOM_CONFORME", label: "Le nom correspond au nom vérifié." },
  { code: "SIRET_CONFORME", label: "Le SIRET correspond au SIRET saisi." },
  { code: "MOINS_DE_3_MOIS", label: "Le document a moins de 3 mois." },
  { code: "TYPE_ACCEPTE", label: "C'est un extrait Kbis, un extrait RNE ou un avis de situation Sirene." },
  { code: "SANS_RETOUCHE", label: "Aucun signe de retouche visible." },
] as const;

/** Validation manuelle sans document (appel ou visio). */
export const MANUAL_CHECKLIST: Record<L2Type, readonly { code: string; label: string }[]> = {
  TELEPHONE: [{ code: "APPEL_DECROCHE", label: "J'ai appelé ce numéro. La personne a répondu et a confirmé son identité." }],
  IDENTITE: [
    { code: "PIECE_VUE_EN_VISIO", label: "J'ai vu la pièce d'identité originale en visio. Elle est valide." },
    { code: "VISAGE_CONFORME", label: "Le visage correspond à la photo de la pièce." },
    { code: "NOM_ET_NAISSANCE_CONFORMES", label: "Le nom et la date de naissance correspondent au compte." },
  ],
  ADRESSE: [
    { code: "JUSTIFICATIF_VU_EN_VISIO", label: "J'ai vu un justificatif de domicile de moins de 3 mois en visio." },
    { code: "NOM_CONFORME", label: "Le nom correspond au nom vérifié." },
    { code: "ADRESSE_CONFORME", label: "L'adresse correspond à l'adresse déclarée." },
  ],
  ENTREPRISE: [{ code: "DOCUMENT_VU_EN_VISIO", label: "J'ai vu un extrait Kbis, RNE ou un avis Sirene de moins de 3 mois en visio, au bon nom." }],
};

/** Toutes les cases de la liste sont cochées. */
export function checklistComplete(list: readonly { code: string }[], checked: readonly string[]): boolean {
  return list.every((c) => checked.includes(c.code));
}
