/**
 * Compatibilité accompagnant ↔ demande, pour le matching MANUEL de l'opérateur.
 * Pur et testable. Aucun score de réputation : seulement des critères objectifs
 * (commune, niveau autorisé par le statut, disponibilités, validation).
 */
import type { CaregiverStatus, CaregiverValidation, TimeSlot } from "@prisma/client";
import { canStatusDoLevel } from "./status-levels";

export type SlotRef = { dayOfWeek: number; slot: TimeSlot };

export type CaregiverForMatching = {
  status: CaregiverStatus | null;
  validation: CaregiverValidation;
  hasDiploma: boolean;
  communes: string[];
  availabilities: SlotRef[];
  /** Proche aidant APA : l'aîné de SA famille (D7). */
  linkedAineId?: string | null;
};

export type RequestForMatching = {
  level: number;
  commune: string;
  slots: SlotRef[];
  /** Aîné de la demande (règle D7 du proche aidant). */
  aineId?: string;
};

export type MatchReason = "NON_VALIDE" | "SANS_STATUT" | "NIVEAU_NON_AUTORISE" | "LIEN_FAMILIAL" | "COMMUNE" | "DISPONIBILITE";

/** D6 : Koudmen propose 1 à 3 profils à la famille, pas plus. */
export const MAX_PROFILES_PER_REQUEST = 3;

export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
  NON_VALIDE: "Profil pas encore validé",
  SANS_STATUT: "Orientation statut non faite",
  NIVEAU_NON_AUTORISE: "Niveau non autorisé pour ce statut",
  LIEN_FAMILIAL: "Proche aidant : seulement pour l'aîné de sa propre famille",
  COMMUNE: "Commune non desservie",
  DISPONIBILITE: "Aucun créneau commun",
};

export type MatchResult = {
  compatible: boolean;
  reasons: MatchReason[];
  /** Créneaux communs (pour l'affichage). */
  commonSlots: SlotRef[];
};

export function commonSlots(a: SlotRef[], b: SlotRef[]): SlotRef[] {
  return a.filter((x) => b.some((y) => y.dayOfWeek === x.dayOfWeek && y.slot === x.slot));
}

export function checkCompatibility(c: CaregiverForMatching, r: RequestForMatching): MatchResult {
  const reasons: MatchReason[] = [];
  if (c.validation !== "VALIDE") reasons.push("NON_VALIDE");
  if (!c.status) reasons.push("SANS_STATUT");
  else if (!canStatusDoLevel(c.status, r.level, { hasDiploma: c.hasDiploma })) reasons.push("NIVEAU_NON_AUTORISE");
  // D7 : le statut « proche aidant via l'APA » n'existe que pour son propre parent (art. L232-7 CASF).
  if (c.status === "PROCHE_AIDANT_APA" && (!c.linkedAineId || c.linkedAineId !== r.aineId)) reasons.push("LIEN_FAMILIAL");
  if (!c.communes.includes(r.commune)) reasons.push("COMMUNE");
  // Une demande sans créneau précis accepte toutes les disponibilités.
  const common = r.slots.length === 0 ? c.availabilities : commonSlots(r.slots, c.availabilities);
  if (r.slots.length > 0 && common.length === 0) reasons.push("DISPONIBILITE");
  return { compatible: reasons.length === 0, reasons, commonSlots: common };
}
