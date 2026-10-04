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
};

export type RequestForMatching = {
  level: number;
  commune: string;
  slots: SlotRef[];
};

export type MatchReason = "NON_VALIDE" | "SANS_STATUT" | "NIVEAU_NON_AUTORISE" | "COMMUNE" | "DISPONIBILITE";

export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
  NON_VALIDE: "Profil pas encore vérifié",
  SANS_STATUT: "Orientation statut non faite",
  NIVEAU_NON_AUTORISE: "Niveau non autorisé pour ce statut",
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
  if (!c.communes.includes(r.commune)) reasons.push("COMMUNE");
  // Une demande sans créneau précis accepte toutes les disponibilités.
  const common = r.slots.length === 0 ? c.availabilities : commonSlots(r.slots, c.availabilities);
  if (r.slots.length > 0 && common.length === 0) reasons.push("DISPONIBILITE");
  return { compatible: reasons.length === 0, reasons, commonSlots: common };
}
