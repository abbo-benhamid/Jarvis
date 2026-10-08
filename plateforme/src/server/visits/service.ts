import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma, ProofFactor, Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { enqueueNotification, notifyLakou } from "@/server/outbox";
import { formatDate } from "@/lib/format";
import { isLaunchMode } from "@/server/config-check";
import { computeVisitProof, deriveVisitStatus, generateHomeCode, VISIT_GRACE_MINUTES } from "./proof";

type Actor = { id: string; role: Role };

/** Code domicile unique, généré avec un aléa cryptographique. */
export async function generateUniqueHomeCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateHomeCode(() => randomInt(0, 1_000_000) / 1_000_000);
    const exists = await db.aine.findUnique({ where: { homeCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un code domicile unique.");
}

export type ProofInput = {
  factor: ProofFactor;
  valid: boolean;
  simulated?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  distanceMeters?: number | null;
  details?: string | null;
};

/**
 * Recalcule le score et le statut d'une visite à partir de ses facteurs.
 * Notifie le cercle Lakou quand la visite devient VALIDEE ou A_VERIFIER.
 */
export async function refreshVisitStatus(visitId: string, now: Date = new Date()) {
  const visit = await db.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { proofs: true, aine: { select: { id: true, firstName: true } } },
  });
  const proof = computeVisitProof(visit.proofs);
  // L1d (D4) : en lancement, QR + position = « Présence probable » ; VALIDEE avec la confirmation de l'aîné.
  const status = deriveVisitStatus(visit, proof, now, { requireElderConfirmation: isLaunchMode() });
  if (status === visit.status && proof.score === visit.proofScore) return visit;

  const updated = await db.visit.update({
    where: { id: visitId },
    data: { status, proofScore: proof.score },
    include: { proofs: true, aine: { select: { id: true, firstName: true } } },
  });
  if (status !== visit.status && (status === "VALIDEE" || status === "A_VERIFIER" || status === "PRESENCE_PROBABLE")) {
    await notifyLakou(
      visit.aineId,
      status === "VALIDEE" ? "VISITE_VALIDEE" : status === "A_VERIFIER" ? "VISITE_A_VERIFIER" : "VISITE_PRESENCE_PROBABLE",
      { aine: visit.aine.firstName, date: formatDate(visit.scheduledStart), score: proof.score },
      { type: "Visit", id: visitId },
    );
  }
  return updated;
}

/** Enregistre (ou remplace) UN facteur de preuve, journalise, puis recalcule le statut. */
export async function recordProof(visitId: string, input: ProofInput, actor: Actor) {
  await db.visitProof.upsert({
    where: { visitId_factor: { visitId, factor: input.factor } },
    create: { visitId, recordedById: actor.id, ...input, simulated: input.simulated ?? false },
    update: { recordedById: actor.id, recordedAt: new Date(), ...input, simulated: input.simulated ?? false },
  });
  await logAudit({
    actor,
    action: "visit.proof.recorded",
    entityType: "Visit",
    entityId: visitId,
    metadata: { factor: input.factor, valid: input.valid, simulated: input.simulated ?? false },
  });
  return refreshVisitStatus(visitId);
}

/**
 * Facteur (c) SIMULÉ : « l'aîné a confirmé » (appel vocal « tapez 1 »).
 * Appelé par la famille (Lot A) ou l'opérateur (Lot C). Le contrôle d'accès
 * (canAccessAine) est fait par l'appelant AVANT cet appel.
 */
export async function confirmElderSimulated(visitId: string, actor: Actor) {
  const visit = await db.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { aine: true, caregiver: { include: { user: true } } },
  });
  await enqueueNotification({
    channel: "VOIX",
    to: visit.aine.phone ?? "téléphone de l'aîné (fictif)",
    template: "APPEL_CONFIRMATION_AINE",
    vars: { aine: visit.aine.firstName, accompagnant: visit.caregiver.user.firstName },
    related: { type: "Visit", id: visitId },
    sandboxId: visit.aine.sandboxId,
  });
  return recordProof(
    visitId,
    {
      factor: "CONFIRMATION_AINE",
      valid: true,
      simulated: true,
      details: `Appel vocal simulé déclenché par ${actor.role === "OPERATEUR" ? "l'opérateur" : "la famille"} : réponse « 1 ».`,
    },
    actor,
  );
}

/**
 * Statut des visites dépassées, COHÉRENT PARTOUT (famille, accompagnant, opérateur).
 * Une visite PREVUE ou EN_COURS dont la fin prévue est passée depuis plus de
 * VISIT_GRACE_MINUTES passe « À vérifier » (ou « Validée » si elle a 2 preuves) EN BASE.
 * À appeler avant chaque lecture de visites. `where` limite le balayage (cercle, accompagnant, monde).
 */
export async function sweepOverdueVisits(where: Prisma.VisitWhereInput = {}, now: Date = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - VISIT_GRACE_MINUTES * 60_000);
  const overdue = await db.visit.findMany({
    where: { AND: [where, { status: { in: ["PREVUE", "EN_COURS"] }, scheduledEnd: { lt: limit } }] },
    select: { id: true },
    take: 200,
  });
  for (const v of overdue) await refreshVisitStatus(v.id, now);
  return overdue.length;
}
