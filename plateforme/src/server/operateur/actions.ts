"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/server/auth/guards";
import { assertAineAccess } from "@/server/access";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { confirmElderSimulated } from "@/server/visits/service";
import { checkCompatibility } from "@/server/rules/matching";
import { communeLabel } from "@/lib/communes";
import { VALIDATION_LABELS } from "@/lib/labels";
import { fail, type ActionResult } from "@/lib/action-result";
import {
  allowedDecisions,
  DECISION_RESULT,
  decisionNeedsReason,
  decisionSchema,
  feedbackStatusSchema,
  FEEDBACK_STATUS_LABELS,
  proposalBlockReason,
  proposalSchema,
  recomputeLevels,
  validationBlockers,
  verificationReviewSchema,
} from "./rules";

/**
 * Server Actions de l'espace opérateur (Lot C).
 * Ordre fixe (RM-16) : requireRole → validation Zod → contrôle de la ressource → écriture + audit.
 */

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Erreur métier levée dans une transaction pour l'annuler, avec un message pour l'opérateur. */
class BusinessError extends Error {}

const AUDIT_ACTION = {
  VALIDER: "caregiver.validate",
  REFUSER: "caregiver.refuse",
  SUSPENDRE: "caregiver.suspend",
  REACTIVER: "caregiver.reactivate",
} as const;

// ─────────────── O3 Décision sur un profil ───────────────

export async function decideCaregiverAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = decisionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez la décision et le motif.", parsed.error.flatten().fieldErrors);
  const { caregiverId, decision, reason } = parsed.data;

  const cg = await db.caregiverProfile.findUnique({
    where: { id: caregiverId },
    include: { verifications: { select: { type: true, status: true } }, user: { select: { id: true, firstName: true } } },
  });
  if (!cg) return fail("Accompagnant introuvable.");
  if (!allowedDecisions(cg.validation).includes(decision)) {
    return fail(`Cette décision n'est pas possible. État actuel du profil : ${VALIDATION_LABELS[cg.validation]}.`);
  }
  if (decision === "VALIDER" || decision === "REACTIVER") {
    const blockers = validationBlockers(cg);
    if (blockers.length > 0) return fail(`Validation impossible. ${blockers.join(" ")}`);
  }

  const to = DECISION_RESULT[decision];
  const levels = recomputeLevels(cg.status, cg.verifications);
  try {
    await db.$transaction(async (tx) => {
      // Garde de concurrence : un autre opérateur a peut-être déjà décidé.
      const res = await tx.caregiverProfile.updateMany({
        where: { id: cg.id, validation: cg.validation },
        data: {
          validation: to,
          validationReason: decisionNeedsReason(decision) ? reason : null,
          reviewedById: user.id,
          reviewedAt: new Date(),
          hasDiploma: levels.hasDiploma,
          allowedLevels: levels.allowedLevels,
        },
      });
      if (res.count !== 1) throw new BusinessError("Le profil a changé entre-temps. Rechargez la page.");

      // Refus ou suspension : les propositions en attente sont annulées. La demande redevient OUVERTE
      // si plus aucune proposition n'attend de réponse.
      let cancelled = 0;
      if (to === "REFUSE" || to === "SUSPENDU") {
        const pending = await tx.missionProposal.findMany({
          where: { caregiverId: cg.id, status: "EN_ATTENTE" },
          select: { id: true, requestId: true },
        });
        cancelled = pending.length;
        if (pending.length > 0) {
          await tx.missionProposal.updateMany({
            where: { id: { in: pending.map((p) => p.id) } },
            data: { status: "ANNULEE", respondedAt: new Date() },
          });
          for (const requestId of new Set(pending.map((p) => p.requestId))) {
            const still = await tx.missionProposal.count({ where: { requestId, status: "EN_ATTENTE" } });
            if (still === 0) {
              await tx.careRequest.updateMany({ where: { id: requestId, status: "PROPOSEE" }, data: { status: "OUVERTE" } });
            }
          }
        }
      }

      await logAudit(
        {
          actor: user,
          action: AUDIT_ACTION[decision],
          entityType: "CaregiverProfile",
          entityId: cg.id,
          metadata: { from: cg.validation, to, withReason: decisionNeedsReason(decision), cancelledProposals: cancelled },
        },
        tx,
      );
      // [À VÉRIFIER] Le socle n'a pas de modèle « suspendu » : la suspension utilise ACCOMPAGNANT_REFUSE (avec le motif).
      if (to === "VALIDE") {
        await notifyUser(cg.user.id, "ACCOMPAGNANT_VALIDE", { prenom: cg.user.firstName }, { type: "CaregiverProfile", id: cg.id }, tx);
      } else {
        await notifyUser(
          cg.user.id,
          "ACCOMPAGNANT_REFUSE",
          { prenom: cg.user.firstName, motif: reason },
          { type: "CaregiverProfile", id: cg.id },
          tx,
        );
      }
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message);
    throw e;
  }

  revalidatePath("/operateur", "layout");
  return { ok: true, message: `Décision enregistrée : ${VALIDATION_LABELS[to]}. L'accompagnant reçoit un message (simulé).` };
}

// ─────────────── O3 Revue d'une vérification ───────────────

export async function reviewVerificationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = verificationReviewSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez votre revue.", parsed.error.flatten().fieldErrors);
  const { verificationId, verdict, note } = parsed.data;

  const item = await db.verificationItem.findUnique({
    where: { id: verificationId },
    include: { caregiver: { select: { id: true, status: true, verifications: { select: { id: true, type: true, status: true } } } } },
  });
  if (!item) return fail("Vérification introuvable.");
  if (item.status === "A_FOURNIR") return fail("L'accompagnant n'a pas encore déclaré cette pièce.");

  await db.$transaction(async (tx) => {
    await tx.verificationItem.update({
      where: { id: item.id },
      data: { status: verdict, reviewNote: note || null, reviewedById: user.id, reviewedAt: new Date() },
    });
    // Le diplôme VALIDÉ ouvre le niveau 4 (salarié famille, proche aidant). Niveaux recalculés côté serveur.
    if (item.type === "DIPLOME") {
      const after = item.caregiver.verifications.map((v) => (v.id === item.id ? { ...v, status: verdict } : v));
      const levels = recomputeLevels(item.caregiver.status, after);
      await tx.caregiverProfile.update({ where: { id: item.caregiver.id }, data: levels });
    }
    await logAudit(
      {
        actor: user,
        action: "verification.reviewed",
        entityType: "VerificationItem",
        entityId: item.id,
        metadata: { caregiverId: item.caregiver.id, type: item.type, verdict },
      },
      tx,
    );
  });

  revalidatePath(`/operateur/accompagnants/${item.caregiver.id}`);
  return { ok: true, message: verdict === "VALIDE" ? "Vérification validée." : "Vérification refusée." };
}

// ─────────────── O5 Proposition (matching manuel) ───────────────

export async function proposeCaregiverAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = proposalSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez la proposition.", parsed.error.flatten().fieldErrors);
  const { requestId, caregiverId, message } = parsed.data;

  let outcome: { ok: true; name: string } | { ok: false; error: string };
  try {
    outcome = await db.$transaction(async (tx) => {
      const request = await tx.careRequest.findUnique({
        where: { id: requestId },
        select: { id: true, level: true, status: true, aine: { select: { commune: true } }, slots: { select: { dayOfWeek: true, slot: true } } },
      });
      const cg = await tx.caregiverProfile.findUnique({
        where: { id: caregiverId },
        select: {
          id: true,
          status: true,
          validation: true,
          hasDiploma: true,
          communes: true,
          availabilities: { select: { dayOfWeek: true, slot: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (!request || !cg) return { ok: false as const, error: "Demande ou accompagnant introuvable." };

      const existing = await tx.missionProposal.findUnique({
        where: { requestId_caregiverId: { requestId, caregiverId } },
        select: { status: true },
      });
      // RÈGLE SERVEUR : on recalcule la compatibilité ici. Le formulaire ne fait jamais foi (RM-01, RM-02).
      const match = checkCompatibility(cg, { level: request.level, commune: request.aine.commune, slots: request.slots });
      const blocked = proposalBlockReason({ requestStatus: request.status, match, existingProposal: existing?.status ?? null });
      if (blocked) return { ok: false as const, error: blocked };

      const proposal = await tx.missionProposal.create({
        data: { requestId, caregiverId, proposedById: user.id, message: message || null },
      });
      if (request.status === "OUVERTE") {
        await tx.careRequest.update({ where: { id: requestId }, data: { status: "PROPOSEE" } });
      }
      await notifyUser(
        cg.user.id,
        "PROPOSITION_MISSION",
        { prenom: cg.user.firstName, niveau: request.level, commune: communeLabel(request.aine.commune) },
        { type: "MissionProposal", id: proposal.id },
        tx,
      );
      await logAudit(
        { actor: user, action: "proposal.created", entityType: "MissionProposal", entityId: proposal.id, metadata: { requestId, caregiverId } },
        tx,
      );
      return { ok: true as const, name: `${cg.user.firstName} ${cg.user.lastName}` };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Cet accompagnant a déjà reçu une proposition pour cette demande.");
    }
    throw e;
  }

  if (!outcome.ok) {
    // Trace de sécurité : une proposition refusée par le serveur est journalisée.
    await logAudit({
      actor: user,
      action: "proposal.blocked",
      entityType: "CareRequest",
      entityId: requestId,
      metadata: { caregiverId, reason: outcome.error },
    });
    return fail(outcome.error);
  }
  revalidatePath("/operateur", "layout");
  return { ok: true, message: `Proposition envoyée à ${outcome.name}. Message simulé dans la boîte d'envoi.` };
}

// ─────────────── O6 Confirmation simulée de l'aîné ───────────────

const visitSchema = z.object({ visitId: z.string().cuid() });

export async function confirmElderAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = visitSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Visite invalide.");
  const visit = await db.visit.findUnique({
    where: { id: parsed.data.visitId },
    select: { id: true, aineId: true, status: true, proofs: { select: { factor: true, valid: true } } },
  });
  if (!visit) return fail("Visite introuvable.");
  await assertAineAccess(user, visit.aineId);
  if (visit.status !== "EN_COURS" && visit.status !== "A_VERIFIER") {
    return fail("La confirmation est possible pour une visite en cours ou à vérifier.");
  }
  if (visit.proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid)) {
    return fail("L'aîné a déjà confirmé cette visite.");
  }
  await confirmElderSimulated(visit.id, user);
  revalidatePath("/operateur", "layout");
  // La visite peut quitter la liste filtrée (ex. « À vérifier » → « Validée ») : le résultat s'affiche en haut de page.
  redirect(`/operateur/visites?confirme=${visit.id}`);
}

// ─────────────── O8 Statut d'un retour testeur ───────────────

export async function setFeedbackStatusAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = feedbackStatusSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Statut invalide.");
  const fb = await db.feedback.findUnique({ where: { id: parsed.data.feedbackId }, select: { id: true, status: true } });
  if (!fb) return fail("Retour introuvable.");
  if (fb.status === parsed.data.status) return { ok: true };
  await db.$transaction(async (tx) => {
    await tx.feedback.update({ where: { id: fb.id }, data: { status: parsed.data.status } });
    await logAudit(
      { actor: user, action: "feedback.status", entityType: "Feedback", entityId: fb.id, metadata: { from: fb.status, to: parsed.data.status } },
      tx,
    );
  });
  revalidatePath("/operateur", "layout");
  return { ok: true, message: `Retour marqué « ${FEEDBACK_STATUS_LABELS[parsed.data.status]} ».` };
}
