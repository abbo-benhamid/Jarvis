"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { canAccessAine } from "@/server/access";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { enqueueNotification, notifyUser } from "@/server/outbox";
import { appUrl } from "@/server/env";
import { sameScope } from "@/server/scope";
import { confirmElderSimulated, generateUniqueHomeCode } from "@/server/visits/service";
import { chooseProfile, MatchingError } from "@/server/matching/service";
import { getCommune } from "@/lib/communes";
import { getPlan } from "@/lib/plans";
import { formatEuros } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import {
  aineCreateSchema,
  aineUpdateSchema,
  cancelRequestSchema,
  careRequestSchema,
  chooseProfileSchema,
  changePlanSchema,
  confirmVisitSchema,
  formDataToObject,
  invitationSchema,
  joinSchema,
  todayIso,
} from "./schemas";
import { canCancelRequest, canConfirmElder, changedFields, displayVisitStatus, invitationExpiry, invitationState } from "./logic";

const CHECK_FIELDS = "Vérifiez les champs en rouge.";
const NOT_FOUND = "Nous ne trouvons pas cet élément dans votre cercle Lakou.";

// ─────────────────────────────── F2 / F3 : profil de l'aîné ───────────────────────────────

/** F2 : crée le profil de l'aîné + consentement + cercle Lakou (payeur) + formule Lakou. */
export async function createAineAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = aineCreateSchema.safeParse(formDataToObject(formData, ["needs"]));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  const commune = getCommune(v.commune);
  if (!commune) return { ok: false, error: CHECK_FIELDS, fieldErrors: { commune: ["Choisissez une commune."] } };

  const homeCode = await generateUniqueHomeCode();
  const now = new Date();
  const aine = await db.$transaction(async (tx) => {
    const created = await tx.aine.create({
      data: {
        firstName: v.firstName,
        lastInitial: v.lastInitial ?? null,
        commune: v.commune,
        addressHint: v.addressHint ?? null,
        // Minimisation : position = centre de la commune.
        latitude: commune.lat,
        longitude: commune.lng,
        phone: v.phone ?? null,
        needs: v.needs,
        activityLevel: v.activityLevel,
        consentGiven: true,
        consentByType: v.consentByType,
        consentByName: v.consentByName,
        consentAt: now,
        homeCode,
        // Le profil appartient au même monde que la famille (bac à sable ou monde réel).
        sandboxId: user.sandboxId,
        ownerId: user.id,
        members: { create: { userId: user.id, relation: v.myRelation, isPayer: true } },
        subscription: { create: { payerId: user.id, plan: "LAKOU", priceCents: 0 } },
      },
      select: { id: true },
    });
    await logAudit({ actor: user, action: "aine.created", entityType: "Aine", entityId: created.id, metadata: { commune: v.commune, level: v.activityLevel } }, tx);
    await logAudit({ actor: user, action: "aine.consent", entityType: "Aine", entityId: created.id, metadata: { consentByType: v.consentByType } }, tx);
    return created;
  });
  revalidatePath("/famille");
  redirect(`/famille/aines/${aine.id}?cree=1`);
}

/** F3 : modifie le profil. Seul le payeur (gestionnaire principal) modifie. */
export async function updateAineAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = aineUpdateSchema.safeParse(formDataToObject(formData, ["needs"]));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  const member = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId: v.aineId, userId: user.id } } });
  if (!member) return { ok: false, error: NOT_FOUND };
  if (!member.isPayer) return { ok: false, error: "Seul le gestionnaire principal du profil peut le modifier." };
  const commune = getCommune(v.commune);
  if (!commune) return { ok: false, error: CHECK_FIELDS, fieldErrors: { commune: ["Choisissez une commune."] } };

  const before = await db.aine.findUniqueOrThrow({ where: { id: v.aineId } });
  const next = {
    firstName: v.firstName,
    lastInitial: v.lastInitial ?? null,
    commune: v.commune,
    addressHint: v.addressHint ?? null,
    phone: v.phone ?? null,
    needs: v.needs,
    activityLevel: v.activityLevel,
    consentByType: v.consentByType,
    consentByName: v.consentByName,
  };
  const changed = changedFields(before as unknown as Record<string, unknown>, next);
  if (changed.length === 0) return { ok: true, message: "Aucune modification à enregistrer." };
  const consentChanged = changed.includes("consentByType") || changed.includes("consentByName");

  await db.$transaction(async (tx) => {
    await tx.aine.update({
      where: { id: v.aineId },
      data: {
        ...next,
        ...(changed.includes("commune") ? { latitude: commune.lat, longitude: commune.lng } : {}),
        ...(consentChanged ? { consentGiven: true, consentAt: new Date() } : {}),
      },
    });
    await logAudit({ actor: user, action: "aine.updated", entityType: "Aine", entityId: v.aineId, metadata: { fields: changed } }, tx);
    if (consentChanged) {
      await logAudit({ actor: user, action: "aine.consent", entityType: "Aine", entityId: v.aineId, metadata: { consentByType: v.consentByType } }, tx);
    }
  });
  revalidatePath(`/famille/aines/${v.aineId}`);
  revalidatePath("/famille");
  redirect(`/famille/aines/${v.aineId}?modifie=1`);
}

// ─────────────────────────────── F4 / F10 : cercle Lakou ───────────────────────────────

/** F4 : crée un lien d'invitation (14 jours). Email facultatif → notification simulée. */
export async function inviteLakouAction(
  _prev: ActionResult<{ link: string; expiresAt: string }>,
  formData: FormData,
): Promise<ActionResult<{ link: string; expiresAt: string }>> {
  const user = await requireRole("FAMILLE");
  const parsed = invitationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  if (!(await canAccessAine(user, v.aineId))) return { ok: false, error: NOT_FOUND };

  const aine = await db.aine.findUniqueOrThrow({ where: { id: v.aineId }, select: { firstName: true } });
  const token = randomBytes(24).toString("base64url");
  const expiresAt = invitationExpiry();
  const link = `${appUrl()}/invitation/${token}`;

  await db.$transaction(async (tx) => {
    const inv = await tx.invitation.create({
      data: { aineId: v.aineId, token, email: v.email ?? null, relation: v.relation, createdById: user.id, expiresAt },
      select: { id: true },
    });
    if (v.email) {
      await enqueueNotification(
        {
          channel: "EMAIL",
          to: v.email,
          template: "INVITATION_LAKOU",
          vars: { from: user.firstName, aine: aine.firstName, link },
          related: { type: "Invitation", id: inv.id },
          sandboxId: user.sandboxId,
        },
        tx,
      );
    }
    // Jamais le jeton ni l'email dans l'audit.
    await logAudit({ actor: user, action: "lakou.invited", entityType: "Invitation", entityId: inv.id, metadata: { aineId: v.aineId, withEmail: Boolean(v.email) } }, tx);
  });
  revalidatePath(`/famille/aines/${v.aineId}/cercle`);
  return {
    ok: true,
    message: v.email ? "Lien créé. Un email simulé est parti. Vous pouvez aussi copier le lien." : "Lien créé. Copiez-le et envoyez-le à votre proche.",
    data: { link, expiresAt: expiresAt.toISOString() },
  };
}

/** F10 : rejoint le cercle Lakou avec un jeton valide. */
export async function joinCircleAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = joinSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: "Ce lien d'invitation n'est pas valide." };
  const inv = await db.invitation.findUnique({ where: { token: parsed.data.token }, include: { aine: { select: { sandboxId: true } } } });
  // Cloisonnement (D2) : un lien d'un bac à sable ne s'ouvre pas depuis un autre monde.
  if (!inv || !sameScope(inv.aine.sandboxId, user.sandboxId)) return { ok: false, error: "Ce lien d'invitation n'est pas valide." };
  const now = new Date();
  const state = invitationState(inv, now);
  if (state === "EXPIREE") return { ok: false, error: "Ce lien a expiré. Demandez un nouveau lien à la personne qui vous a invité(e)." };
  if (state === "UTILISEE") return { ok: false, error: "Ce lien a déjà été utilisé. Demandez un nouveau lien à la personne qui vous a invité(e)." };

  const existing = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId: inv.aineId, userId: user.id } } });
  if (existing) redirect(`/famille/aines/${inv.aineId}`);

  const joined = await db.$transaction(async (tx) => {
    // Une seule utilisation : la mise à jour échoue si un autre compte a utilisé le lien entre-temps.
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, acceptedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    if (claimed.count !== 1) return false;
    await tx.lakouMember.create({ data: { aineId: inv.aineId, userId: user.id, relation: inv.relation, isPayer: false } });
    await logAudit({ actor: user, action: "lakou.joined", entityType: "Aine", entityId: inv.aineId, metadata: { invitationId: inv.id } }, tx);
    return true;
  });
  if (!joined) return { ok: false, error: "Ce lien a déjà été utilisé. Demandez un nouveau lien à la personne qui vous a invité(e)." };
  revalidatePath("/famille");
  redirect(`/famille/aines/${inv.aineId}?bienvenue=1`);
}

// ─────────────────────────────── F5 / F6 : demandes ───────────────────────────────

/** F6 : crée une demande d'accompagnement (statut OUVERTE). */
export async function createRequestAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = careRequestSchema(todayIso()).safeParse(formDataToObject(formData, ["slots"]));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  if (!(await canAccessAine(user, v.aineId))) return { ok: false, error: NOT_FOUND, fieldErrors: { aineId: ["Choisissez un aîné de votre cercle."] } };

  // Créneaux uniques (contrainte @@unique).
  const slots = [...new Map(v.slots.map((s) => [`${s.dayOfWeek}-${s.slot}`, s])).values()];
  await db.$transaction(async (tx) => {
    const req = await tx.careRequest.create({
      data: {
        aineId: v.aineId,
        createdById: user.id,
        level: v.level,
        frequency: v.frequency,
        durationMinutes: v.durationMinutes,
        startDate: v.startDate ? new Date(`${v.startDate}T12:00:00Z`) : null,
        notes: v.notes ?? null,
        employerType: v.employerType,
        employerName: v.employerName ?? null,
        status: "OUVERTE",
        slots: { create: slots },
      },
      select: { id: true },
    });
    await logAudit({ actor: user, action: "request.created", entityType: "CareRequest", entityId: req.id, metadata: { aineId: v.aineId, level: v.level, frequency: v.frequency } }, tx);
  });
  revalidatePath("/famille/demandes");
  revalidatePath("/famille");
  redirect("/famille/demandes?envoyee=1");
}

/** F5 : annule une demande OUVERTE ou PROPOSEE. Les propositions en attente sont annulées. */
export async function cancelRequestAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = cancelRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  const req = await db.careRequest.findUnique({ where: { id: parsed.data.requestId }, select: { id: true, aineId: true, status: true } });
  if (!req || !(await canAccessAine(user, req.aineId))) return { ok: false, error: NOT_FOUND };
  if (!canCancelRequest(req.status)) return { ok: false, error: "Cette demande ne peut plus être annulée." };

  await db.$transaction(async (tx) => {
    await tx.careRequest.update({ where: { id: req.id }, data: { status: "ANNULEE" } });
    await tx.missionProposal.updateMany({ where: { requestId: req.id, status: "EN_ATTENTE" }, data: { status: "ANNULEE" } });
    await logAudit({ actor: user, action: "request.cancelled", entityType: "CareRequest", entityId: req.id, metadata: { previousStatus: req.status } }, tx);
  });
  revalidatePath("/famille/demandes");
  revalidatePath("/famille");
  redirect("/famille/demandes?annulee=1");
}

/**
 * F5 (D6) : la famille CHOISIT un des profils proposés par Koudmen.
 * Ensuite, l'accompagnant choisi accepte ou refuse librement.
 */
export async function chooseProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = chooseProfileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  const proposal = await db.missionProposal.findUnique({
    where: { id: parsed.data.proposalId },
    select: { id: true, request: { select: { aineId: true } } },
  });
  // Contrôle d'accès : le profil concerne un aîné du cercle Lakou (cloisonne aussi les bacs à sable).
  if (!proposal || !(await canAccessAine(user, proposal.request.aineId))) return { ok: false, error: NOT_FOUND };
  let chosen: { caregiverFirstName: string };
  try {
    chosen = await chooseProfile(user, proposal.id);
  } catch (e) {
    if (e instanceof MatchingError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/famille/demandes");
  revalidatePath("/famille");
  redirect(`/famille/demandes?choisi=${encodeURIComponent(chosen.caregiverFirstName)}`);
}

// ─────────────────────────────── F7 : visites ───────────────────────────────

/** F7 : « L'aîné a confirmé (appel simulé) » → facteur (c) de la preuve 2 sur 3. */
export async function confirmVisitAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = confirmVisitSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  const visit = await db.visit.findUnique({
    where: { id: parsed.data.visitId },
    select: { id: true, aineId: true, status: true, checkInAt: true, checkOutAt: true, scheduledEnd: true, proofs: { select: { factor: true, valid: true } } },
  });
  // Contrôle d'accès AVANT confirmElderSimulated (voir src/server/visits/service.ts).
  if (!visit || !(await canAccessAine(user, visit.aineId))) return { ok: false, error: NOT_FOUND };
  const status = displayVisitStatus(visit);
  if (!canConfirmElder(status, visit.proofs)) {
    return { ok: false, error: "Cette visite ne demande pas de confirmation de l'aîné." };
  }
  const updated = await confirmElderSimulated(visit.id, user);
  revalidatePath("/famille/visites");
  revalidatePath("/famille");
  // Redirection : le bouton disparaît après la confirmation, le message s'affiche en haut de la page.
  redirect(`/famille/visites?confirmee=${updated.status === "VALIDEE" ? "validee" : "partielle"}`);
}

// ─────────────────────────────── F9 : formule ───────────────────────────────

/** F9 : change la formule (payeur seulement). Paiement SIMULÉ. */
export async function changePlanAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = changePlanSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: "Choisissez une formule." };
  const v = parsed.data;
  const member = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId: v.aineId, userId: user.id } }, select: { isPayer: true } });
  if (!member) return { ok: false, error: NOT_FOUND };
  if (!member.isPayer) return { ok: false, error: "Seul le payeur peut changer la formule." };

  const plan = getPlan(v.plan);
  const aine = await db.aine.findUniqueOrThrow({ where: { id: v.aineId }, select: { firstName: true, subscription: { select: { plan: true } } } });
  if (aine.subscription?.plan === v.plan) return { ok: true, message: `La formule ${plan.name} est déjà active.` };

  await db.$transaction(async (tx) => {
    const sub = await tx.subscription.upsert({
      where: { aineId: v.aineId },
      create: { aineId: v.aineId, payerId: user.id, plan: v.plan, priceCents: plan.priceCents },
      update: { plan: v.plan, priceCents: plan.priceCents, payerId: user.id, status: "ACTIVE", startedAt: new Date(), endedAt: null },
      select: { id: true },
    });
    await tx.simulatedPayment.create({ data: { subscriptionId: sub.id, amountCents: plan.priceCents, status: "SIMULE_REUSSI" } });
    await notifyUser(user.id, "PAIEMENT_SIMULE", { formule: plan.name, aine: aine.firstName, montant: formatEuros(plan.priceCents) }, { type: "Subscription", id: sub.id }, tx);
    await logAudit({ actor: user, action: "plan.changed", entityType: "Subscription", entityId: sub.id, metadata: { aineId: v.aineId, from: aine.subscription?.plan ?? null, to: v.plan } }, tx);
  });
  revalidatePath("/famille/formule");
  revalidatePath("/famille");
  return { ok: true, message: `Formule ${plan.name} activée pour ${aine.firstName}. Paiement simulé : aucun argent n'a été prélevé.` };
}
