"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ageInYears } from "@/server/rules/status-levels";
import { requireRole } from "@/server/auth/guards";
import { assertAineAccess } from "@/server/access";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { confirmElderSimulated } from "@/server/visits/service";
import { MatchingError, proposeProfile, releaseCaregiver } from "@/server/matching/service";
import { isConcurrencyError } from "@/server/matching/locks";
import { REAL_WORLD, sameScope } from "@/server/scope";
import { VALIDATION_LABELS } from "@/lib/labels";
import { fail, type ActionResult } from "@/lib/action-result";
import { isLaunchMode } from "@/server/launch";
import {
  allowedDecisions,
  DECISION_RESULT,
  decisionNeedsReason,
  decisionSchema,
  feedbackStatusSchema,
  FEEDBACK_STATUS_LABELS,
  proposalSchema,
  recomputeLevels,
  reviewProblem,
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
    include: { verifications: { select: { type: true, status: true } }, user: { select: { id: true, firstName: true, sandboxId: true } } },
  });
  // Cloisonnement (D2) : l'opérateur réel n'agit que sur le monde réel.
  if (!cg || !sameScope(cg.user.sandboxId, REAL_WORLD)) return fail("Accompagnant introuvable.");
  if (!allowedDecisions(cg.validation).includes(decision)) {
    return fail(`Cette décision n'est pas possible. État actuel du profil : ${VALIDATION_LABELS[cg.validation]}.`);
  }
  if (decision === "VALIDER" || decision === "REACTIVER") {
    const blockers = validationBlockers(cg);
    if (blockers.length > 0) return fail(`Validation impossible. ${blockers.join(" ")}`);
  }

  const to = DECISION_RESULT[decision];
  const levels = recomputeLevels(cg.status, cg.verifications, cg.birthDate ? ageInYears(cg.birthDate) : null);
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
          // R6 (J6) : à la validation, les réponses brutes de l'orientation sont effacées (seul le statut déduit reste).
          ...(to === "VALIDE" ? { orientationAnswers: Prisma.DbNull } : {}),
        },
      });
      if (res.count !== 1) throw new BusinessError("Le profil a changé entre-temps. Rechargez la page.");

      // A1 : refus ou suspension → propositions actives (choisies ET à choisir) annulées, missions SUSPENDUE,
      // visites futures annulées, demandes rouvertes, famille prévenue. Une seule fonction partagée.
      const released =
        to === "REFUSE" || to === "SUSPENDU"
          ? await releaseCaregiver(tx, cg.id, user)
          : { cancelledProposals: 0, suspendedMissions: 0, cancelledVisits: 0, reopenedRequests: 0 };

      await logAudit(
        {
          actor: user,
          action: AUDIT_ACTION[decision],
          entityType: "CaregiverProfile",
          entityId: cg.id,
          metadata: { from: cg.validation, to, withReason: decisionNeedsReason(decision), ...released },
        },
        tx,
      );
      if (to === "VALIDE") {
        await notifyUser(cg.user.id, "ACCOMPAGNANT_VALIDE", { prenom: cg.user.firstName }, { type: "CaregiverProfile", id: cg.id }, tx);
      } else {
        await notifyUser(
          cg.user.id,
          to === "SUSPENDU" ? "ACCOMPAGNANT_SUSPENDU" : "ACCOMPAGNANT_REFUSE",
          { prenom: cg.user.firstName, motif: reason },
          { type: "CaregiverProfile", id: cg.id },
          tx,
        );
      }
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message);
    if (isConcurrencyError(e)) return fail("Le profil ou une demande a changé entre-temps. Rechargez la page, puis réessayez.");
    throw e;
  }

  revalidatePath("/operateur", "layout");
  return { ok: true, message: `Décision enregistrée : ${VALIDATION_LABELS[to]}. ${isLaunchMode() ? "Koudmen prévient l'accompagnant." : "L'accompagnant reçoit un message (simulé)."}` };
}

// ─────────────── O3 Revue d'une vérification ───────────────

export async function reviewVerificationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = verificationReviewSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez votre revue.", parsed.error.flatten().fieldErrors);
  const { verificationId, verdict, seenOn } = parsed.data;

  const item = await db.verificationItem.findUnique({
    where: { id: verificationId },
    include: {
      caregiver: {
        select: { id: true, status: true, birthDate: true, user: { select: { sandboxId: true } }, verifications: { select: { id: true, type: true, status: true } } },
      },
    },
  });
  if (!item || !sameScope(item.caregiver.user?.sandboxId, REAL_WORLD)) return fail("Vérification introuvable.");
  if (item.status === "A_FOURNIR") return fail("L'accompagnant n'a pas encore déclaré cette pièce.");
  const problem = reviewProblem(item.type, parsed.data);
  if (problem) return fail(problem.message, { [problem.field]: [problem.message] });
  // R6 (J6) : casier B3 → aucun texte libre, seulement la date « vu le » et le verdict.
  const b3 = item.type === "CASIER_B3";
  const note = b3 ? null : parsed.data.note || null;

  await db.$transaction(async (tx) => {
    await tx.verificationItem.update({
      where: { id: item.id },
      data: {
        status: verdict,
        reviewNote: note,
        reviewedById: user.id,
        reviewedAt: new Date(),
        ...(b3 ? { seenOn: new Date(`${seenOn}T00:00:00Z`), declaration: null } : {}),
      },
    });
    // Le diplôme VALIDÉ ouvre le niveau 4 (salarié famille, proche aidant). Niveaux recalculés côté serveur.
    if (item.type === "DIPLOME") {
      const after = item.caregiver.verifications.map((v) => (v.id === item.id ? { ...v, status: verdict } : v));
      const levels = recomputeLevels(item.caregiver.status, after, item.caregiver.birthDate ? ageInYears(item.caregiver.birthDate) : null);
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

// ─────────────── O5 Proposition à la famille (matching manuel, flux D6) ───────────────

/**
 * Koudmen PROPOSE un profil à la famille (1 à 3 profils par demande). La famille choisit ensuite.
 * Toutes les règles (monde réel, compatibilité, maximum de 3) sont dans le service partagé.
 */
export async function proposeCaregiverAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = proposalSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez la proposition.", parsed.error.flatten().fieldErrors);
  const { requestId, caregiverId, message } = parsed.data;

  let name: string;
  try {
    ({ caregiverName: name } = await proposeProfile(user, { requestId, caregiverId, message }, REAL_WORLD));
  } catch (e) {
    if (!(e instanceof MatchingError)) throw e;
    // Trace de sécurité : une proposition refusée par le serveur est journalisée.
    await logAudit({ actor: user, action: "proposal.blocked", entityType: "CareRequest", entityId: requestId, metadata: { caregiverId, reason: e.message } });
    return fail(e.message);
  }
  revalidatePath("/operateur", "layout");
  return { ok: true, message: `Profil de ${name} proposé à la famille. La famille choisit.${isLaunchMode() ? "" : " Message simulé dans la boîte d'envoi."}` };
}

// ─────────────── O6 Confirmation simulée de l'aîné ───────────────

const visitSchema = z.object({ visitId: z.string().cuid() });

/** L1-B (R7) : l'opérateur ne tranche plus une visite. La famille employeur le fait dans son espace. */
const OPERATOR_CONFIRM_DISABLED = "Une visite à vérifier est tranchée par la famille employeur, dans son espace. L'opérateur ne la confirme pas.";

export async function confirmElderAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = visitSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Visite invalide.");
  // L1-B (R7) : désactivé. Le code ci-dessous reste pour un retour arrière décidé par l'orchestrateur.
  if (process.env.KOUDMEN_OPERATEUR_CONFIRME !== "true") return fail(OPERATOR_CONFIRM_DISABLED);
  const visit = await db.visit.findUnique({
    where: { id: parsed.data.visitId },
    select: { id: true, aineId: true, status: true, aine: { select: { sandboxId: true } }, proofs: { select: { factor: true, valid: true } } },
  });
  if (!visit || !sameScope(visit.aine?.sandboxId, REAL_WORLD)) return fail("Visite introuvable.");
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
