import type { StatusTone } from "@/components/ui/status-card";
import type { ProofBadgeStatus } from "@/components/ui/badge";
import type { VisitStatus } from "@prisma/client";

export type AineStatus = { lead: string; word: string; tone: StatusTone; kreyol?: string };

/**
 * Phrase d'état de la carte « Elle va bien. » (maquette, écran b), tirée du dernier Kayé.
 * Le prénom remplace « Elle » : Koudmen ne connaît pas le genre de l'aîné.
 * Jamais le ton « alerte » (hibiscus) : le Kayé est une observation, pas une alerte médicale.
 */
export function aineStatus(firstName: string, kaye: { mood: number; alertFlag: boolean }): AineStatus {
  if (kaye.alertFlag) return { lead: "Un point", word: "à surveiller.", tone: "surveiller" };
  if (kaye.mood >= 4) return { lead: `${firstName} va`, word: "bien.", tone: "bien", kreyol: "Sa ka maché" };
  if (kaye.mood === 3) return { lead: `${firstName} va`, word: "correctement.", tone: "bien" };
  return { lead: `${firstName} a le moral`, word: "un peu bas.", tone: "surveiller" };
}

/** Badge de preuve d'un Kayé : « Prouvée » si la visite est validée, sinon « En attente » (vérification par Koudmen). */
export function kayeProof(status: VisitStatus | undefined): ProofBadgeStatus {
  return status === "VALIDEE" ? "preuve" : "neutre";
}
