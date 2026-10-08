/**
 * Règles PURES de l'espace opérateur (Lot C). Aucune dépendance serveur : testable.
 * - Décisions sur un accompagnant (revue humaine, motif obligatoire pour refuser / suspendre).
 * - Revue des vérifications (le diplôme validé ouvre le niveau 4).
 * - Garde serveur d'une proposition (refus d'une proposition incompatible).
 * - Tri des candidats SANS note ni réputation (créneaux communs, puis nom).
 */
import type {
  CaregiverStatus,
  CaregiverValidation,
  FeedbackStatus,
  ProposalStatus,
  RequestStatus,
  VerificationStatus,
  VerificationType,
} from "@prisma/client";
import { z } from "zod";
import { allowedLevelsFor, type Level } from "@/server/rules/status-levels";
import { MATCH_REASON_LABELS, type MatchResult } from "@/server/rules/matching";
import { rateBelowSalariedFloor } from "@/server/accompagnant/rules";

// ─────────────── Décisions sur un accompagnant ───────────────

export const CAREGIVER_DECISIONS = ["VALIDER", "REFUSER", "SUSPENDRE", "REACTIVER"] as const;
export type CaregiverDecision = (typeof CAREGIVER_DECISIONS)[number];

export const DECISION_LABELS: Record<CaregiverDecision, string> = {
  VALIDER: "Valider le profil",
  REFUSER: "Refuser le profil",
  SUSPENDRE: "Suspendre le profil",
  REACTIVER: "Réactiver le profil",
};

/** Validation obtenue après chaque décision. */
export const DECISION_RESULT: Record<CaregiverDecision, CaregiverValidation> = {
  VALIDER: "VALIDE",
  REFUSER: "REFUSE",
  SUSPENDRE: "SUSPENDU",
  REACTIVER: "VALIDE",
};

/** Décisions possibles selon l'état actuel (cycle § 4.3 de la spécification). */
export function allowedDecisions(validation: CaregiverValidation): CaregiverDecision[] {
  switch (validation) {
    case "EN_ATTENTE":
      return ["VALIDER", "REFUSER"];
    case "VALIDE":
      return ["SUSPENDRE"];
    case "SUSPENDU":
      return ["REACTIVER", "REFUSER"];
    // L2 : complément demandé → l'accompagnant complète ; l'opérateur peut seulement refuser (second avis).
    case "A_COMPLETER":
      return ["REFUSER"];
    // L2 : un élément a expiré (pas une sanction) ; l'élément renouvelé rend le profil VALIDE tout seul.
    case "EXPIRE":
      return ["SUSPENDRE", "REFUSER"];
    default:
      // BROUILLON : profil incomplet. REFUSE : l'accompagnant corrige puis redemande.
      return [];
  }
}

/** Le motif est obligatoire pour refuser et pour suspendre (RM-07). */
export function decisionNeedsReason(d: CaregiverDecision): boolean {
  return d === "REFUSER" || d === "SUSPENDRE";
}

export const REASON_MIN = 10;
export const REASON_MAX = 1000;

/** L2 (étude § 6.5) : motifs fermés d'un refus de dossier. */
export const REFUSAL_CODES = [
  "IDENTITE_NON_CONFIRMEE",
  "DOCUMENT_FRAUDULEUX",
  "MINEUR",
  "AGE_INSUFFISANT_NIVEAU",
  "B3_NON_CONFORME",
  "ENTREPRISE_CESSEE",
  "STATUT_INCOMPATIBLE",
  "DOSSIER_INCOMPLET_90J",
  "COMPTE_EN_DOUBLE",
] as const;

export const decisionSchema = z
  .object({
    caregiverId: z.string().cuid(),
    decision: z.enum(CAREGIVER_DECISIONS, { errorMap: () => ({ message: "Choisissez une décision." }) }),
    reason: z.string().trim().max(REASON_MAX, `${REASON_MAX} caractères maximum.`).default(""),
    /** L2 : motif fermé, obligatoire pour refuser (en plus du texte envoyé à l'accompagnant). */
    motifCode: z.preprocess((v) => (v === "" ? undefined : v), z.enum(REFUSAL_CODES).optional()),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "REFUSER" && !v.motifCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["motifCode"], message: "Choisissez le motif du refus dans la liste." });
    }
    if (decisionNeedsReason(v.decision) && v.reason.length < REASON_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: `Écrivez le motif (${REASON_MIN} caractères minimum). L'accompagnant le reçoit.`,
      });
    }
  });

/** Vérifications qui ne bloquent pas la validation (le diplôme ouvre seulement le niveau 4). */
export const OPTIONAL_VERIFICATIONS: readonly VerificationType[] = ["DIPLOME"];

/**
 * Raisons qui empêchent de VALIDER un profil (revue humaine complète).
 * Liste vide = validation possible.
 */
export function validationBlockers(p: {
  status: CaregiverStatus | null;
  communes: string[];
  verifications: { type: VerificationType; status: VerificationStatus }[];
  /** D10 : contrôlé si fourni (tarif en centimes). */
  hourlyRateCents?: number | null;
}): string[] {
  const out: string[] = [];
  if (!p.status) out.push("L'orientation statut n'est pas faite.");
  if (p.communes.length === 0) out.push("Aucune commune desservie.");
  if (rateBelowSalariedFloor(p.status, p.hourlyRateCents)) out.push("Le tarif est sous le minimum légal d'un salarié (D10).");
  if (p.verifications.length === 0) out.push("Aucune vérification déclarée.");
  const pending = p.verifications.filter((v) => !OPTIONAL_VERIFICATIONS.includes(v.type) && v.status !== "VALIDE");
  if (pending.length > 0) out.push(`${pending.length} vérification(s) obligatoire(s) pas encore validée(s).`);
  return out;
}

/**
 * Niveaux recalculés côté serveur (RM-03). Le diplôme compte seulement s'il est VALIDÉ par l'opérateur.
 */
export function recomputeLevels(
  status: CaregiverStatus | null,
  verifications: { type: VerificationType; status: VerificationStatus }[],
  /** R6 (J26) : âge de l'accompagnant ; sous 21 ans, pas de niveau 3. Inconnu → pas de restriction. */
  age: number | null = null,
): { hasDiploma: boolean; allowedLevels: Level[] } {
  const hasDiploma = verifications.some((v) => v.type === "DIPLOME" && v.status === "VALIDE");
  return { hasDiploma, allowedLevels: status ? allowedLevelsFor(status, { hasDiploma, age }) : [] };
}

// ─────────────── Revue d'une vérification ───────────────

/**
 * Revue d'une vérification. R6 (J6) : pour le casier B3, AUCUN texte libre : seulement « vu le … »
 * (date) et le verdict (conforme / non conforme). Ce contrôle dépend du type : il est dans l'action.
 */
export const verificationReviewSchema = z.object({
  verificationId: z.string().cuid(),
  verdict: z.enum(["VALIDE", "REFUSE"], { errorMap: () => ({ message: "Choisissez Valider ou Refuser." }) }),
  note: z.string().trim().max(500, "500 caractères maximum.").default(""),
  seenOn: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").optional()),
});

/** Problème de la revue selon le type de vérification (null si correcte). */
export function reviewProblem(type: VerificationType, v: { verdict: "VALIDE" | "REFUSE"; note: string; seenOn?: string }): { field: "note" | "seenOn"; message: string } | null {
  if (type === "CASIER_B3") {
    if (!v.seenOn) return { field: "seenOn", message: "Indiquez la date où vous avez vu l'extrait B3." };
    return null;
  }
  if (v.verdict === "REFUSE" && v.note.length < 5) return { field: "note", message: "Écrivez pourquoi vous refusez cette vérification." };
  return null;
}

// ─────────────── Proposition (matching manuel) ───────────────

export const proposalSchema = z.object({
  requestId: z.string().cuid(),
  caregiverId: z.string().cuid(),
  message: z.string().trim().max(500, "500 caractères maximum.").default(""),
});

/**
 * Garde SERVEUR d'une proposition. Retourne un message d'erreur, ou null si la proposition est permise.
 * Exemple : un auto-entrepreneur sur un niveau 3 → refus (RM-01, RM-02).
 */
export function proposalBlockReason(p: {
  requestStatus: RequestStatus;
  match: MatchResult;
  existingProposal: ProposalStatus | null;
}): string | null {
  if (p.requestStatus !== "OUVERTE" && p.requestStatus !== "PROPOSEE") {
    return "Cette demande n'accepte plus de proposition.";
  }
  if (!p.match.compatible) {
    const reasons = p.match.reasons.map((r) => MATCH_REASON_LABELS[r]).join(", ");
    return `Proposition refusée : accompagnant incompatible (${reasons}).`;
  }
  if (p.existingProposal) {
    // Pas de nouvelle proposition après un refus : un refus reste libre et sans relance (RM-05).
    return "Cet accompagnant a déjà reçu une proposition pour cette demande.";
  }
  return null;
}

export type Candidate<T> = { name: string; match: MatchResult; data: T };

/**
 * Tri des candidats : compatibles d'abord, puis nombre de créneaux communs, puis nom.
 * AUCUNE note, AUCUN score de réputation, AUCUN compteur de refus (RM-05, RM-06).
 */
export function sortCandidates<T>(list: Candidate<T>[]): Candidate<T>[] {
  return [...list].sort((a, b) => {
    if (a.match.compatible !== b.match.compatible) return a.match.compatible ? -1 : 1;
    const slots = b.match.commonSlots.length - a.match.commonSlots.length;
    if (slots !== 0) return slots;
    return a.name.localeCompare(b.name, "fr");
  });
}

// ─────────────── Retours testeurs ───────────────

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NOUVEAU: "Nouveau",
  LU: "Lu",
  TRAITE: "Traité",
};

export const feedbackStatusSchema = z.object({
  feedbackId: z.string().cuid(),
  status: z.enum(["NOUVEAU", "LU", "TRAITE"]),
});

export const RATING_LABELS: Record<number, string> = {
  1: "Très mauvais",
  2: "Mauvais",
  3: "Moyen",
  4: "Bien",
  5: "Très bien",
};

// ─────────────── Affichage ───────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ancienneté lisible : « aujourd'hui », « hier », « il y a 3 jours ». */
export function ageLabel(from: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - from.getTime()) / DAY_MS);
  if (days <= 0) {
    const hours = Math.floor((now.getTime() - from.getTime()) / (60 * 60 * 1000));
    return hours <= 0 ? "il y a moins d'une heure" : `il y a ${hours} h`;
  }
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** Nombre de jours écoulés (pour signaler une demande ancienne). */
export function ageInDays(from: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));
}

/** Une demande sans proposition depuis plus de ce délai est signalée en priorité. */
export const STALE_REQUEST_DAYS = 2;

/** Données CSV : échappe les guillemets et neutralise les formules (=, +, -, @). */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
