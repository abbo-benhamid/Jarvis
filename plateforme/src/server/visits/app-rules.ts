/**
 * Lot A2 (API v1 de l'app accompagnant) : règles PURES, sans base de données.
 * - écart d'horloge entre l'appareil et le serveur ;
 * - heure retenue pour un événement hors ligne ;
 * - conversion d'une visite (Prisma) vers le contrat `Visite` (liste FERMÉE de champs, RGPD).
 */
import type { CaregiverValidation, Frequency, MissionStatus, ProofFactor, VisitStatus } from "@prisma/client";
import { ECART_HORLOGE_MAX_H, SEUIL_PREUVE, type MotifRefus, type Visite } from "@/contracts/v1/visits";
import { communeLabel } from "@/lib/communes";
import { checkInWindow, visitAcceptsProof } from "@/server/accompagnant/rules";
import { computeVisitProof } from "./proof";

const H = 3_600_000;

/** true si l'heure de l'appareil s'écarte de plus de 12 h de l'heure du serveur (dans un sens ou dans l'autre). */
export function isClockSkewed(occurredAt: Date, receivedAt: Date): boolean {
  return Math.abs(receivedAt.getTime() - occurredAt.getTime()) > ECART_HORLOGE_MAX_H * H;
}

/**
 * Heure retenue pour appliquer un événement :
 * - horloge fiable : l'heure de l'appareil (une visite faite hors ligne garde son heure réelle),
 *   jamais dans le futur du serveur ;
 * - horloge suspecte : l'heure du serveur (l'heure de l'appareil ne sert pas à entrer dans une fenêtre de check-in).
 */
export function effectiveEventTime(occurredAt: Date, receivedAt: Date): Date {
  if (isClockSkewed(occurredAt, receivedAt)) return receivedAt;
  return occurredAt.getTime() > receivedAt.getTime() ? receivedAt : occurredAt;
}

/** Code d'erreur métier du Lot B → motif de refus du contrat. */
export function motifFromServiceCode(code: "INTROUVABLE" | "INTERDIT" | "CONFLIT" | "INVALIDE" | "TARIF"): MotifRefus {
  if (code === "TARIF") return "INVALIDE";
  return code;
}

export type AppVisitRow = {
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: VisitStatus;
  proofScore: number;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  clockSkewAt: Date | null;
  aine: { firstName: string; lastInitial: string | null; commune: string; addressHint: string | null };
  mission: { status: MissionStatus; request: { level: number; frequency: Frequency; durationMinutes: number; notes: string | null } };
  caregiver: { validation: CaregiverValidation };
  proofs: { factor: ProofFactor; valid: boolean }[];
  journal: { id: string } | null;
};

/** Sélection Prisma qui produit `AppVisitRow` : rien de plus (ni code domicile, ni téléphone, ni besoins). */
export const APP_VISIT_SELECT = {
  id: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  proofScore: true,
  checkInAt: true,
  checkOutAt: true,
  clockSkewAt: true,
  aine: { select: { firstName: true, lastInitial: true, commune: true, addressHint: true } },
  mission: { select: { status: true, request: { select: { level: true, frequency: true, durationMinutes: true, notes: true } } } },
  caregiver: { select: { validation: true } },
  proofs: { select: { factor: true, valid: true } },
  journal: { select: { id: true } },
} as const;

/** Visite (Prisma) → contrat `Visite`. */
export function toVisiteDto(v: AppVisitRow, now: Date, testMode: boolean): Visite {
  const proof = computeVisitProof(v.proofs);
  const active = v.caregiver.validation === "VALIDE" && v.mission.status === "ACTIVE";
  return {
    id: v.id,
    debut: v.scheduledStart.toISOString(),
    fin: v.scheduledEnd.toISOString(),
    statut: v.status,
    aine: {
      prenom: v.aine.firstName,
      initialeNom: v.aine.lastInitial,
      commune: v.aine.commune,
      communeLibelle: communeLabel(v.aine.commune),
      adresseApproximative: v.aine.addressHint,
      // [À VÉRIFIER] Le schéma n'a pas encore de champ « centres d'intérêt » pour l'aîné : liste vide.
      interets: [],
    },
    demande: {
      niveau: v.mission.request.level,
      frequence: v.mission.request.frequency,
      dureeMinutes: v.mission.request.durationMinutes,
      consignes: v.mission.request.notes,
    },
    preuve: {
      score: proof.score,
      seuil: SEUIL_PREUVE,
      facteursValides: proof.validFactors,
      checkInA: v.checkInAt?.toISOString() ?? null,
      checkOutA: v.checkOutAt?.toISOString() ?? null,
      horlogeSuspecte: v.clockSkewAt !== null,
    },
    kayePublie: v.journal !== null,
    actions: {
      checkIn: active && v.checkInAt === null && visitAcceptsProof(v) && checkInWindow(v, now, testMode) === "OUVERT",
      checkOut: v.checkInAt !== null && v.checkOutAt === null,
      kaye: active && v.checkInAt !== null && v.journal === null,
    },
  };
}
