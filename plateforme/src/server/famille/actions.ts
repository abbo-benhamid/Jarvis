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
import { addressRefusal, computeHomeLocation, readAddress } from "@/server/presence/address";
import { cancelCareRequest, chooseProfile, MatchingError } from "@/server/matching/service";
import { trackEvent } from "@/server/sandbox/events";
import { getCommune } from "@/lib/communes";
import { getPlan, NO_PAYMENT_NOTICE } from "@/lib/plans";
import { isLaunchMode, assertRealDataAllowed, RealDataClosedError } from "@/server/launch";
import { ActivationError, requestActivation } from "@/server/offre/activation";
import { formatEuros } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import {
  caregiverLinkSchema,
  aineCreateSchema,
  aineLaunchCreateSchema,
  aineLaunchUpdateSchema,
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
/** R5 : message tant que l'accord de l'aîné manque. */
const ACCORD_MISSING = "Un conseiller Koudmen doit d'abord appeler l'aîné pour recueillir son accord. Vous pourrez ensuite faire une demande.";

// ─────────────────────────────── F2 / F3 : profil de l'aîné ───────────────────────────────

/** F2 : crée le profil de l'aîné + consentement + cercle Lakou (payeur) + formule Lakou. */
export async function createAineAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  // R1 : en préinscription, aucune fiche aîné réelle.
  try {
    assertRealDataAllowed();
  } catch (e) {
    if (e instanceof RealDataClosedError) return { ok: false, error: e.message };
    throw e;
  }
  if (isLaunchMode()) return createAineForConsent(user, formData);
  const parsed = aineCreateSchema.safeParse(formDataToObject(formData, ["needs"]));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  const commune = getCommune(v.commune);
  if (!commune) return { ok: false, error: CHECK_FIELDS, fieldErrors: { commune: ["Choisissez une commune."] } };

  // L1-B (L8, R1/R5) : adresse exacte seulement si les données réelles sont permises (l'accord est donné ici).
  if (v.address) {
    const refusal = addressRefusal({ consentGiven: true, sandboxId: user.sandboxId });
    if (refusal) return { ok: false, error: CHECK_FIELDS, fieldErrors: { address: [refusal] } };
  }
  const home = await computeHomeLocation(v.address ?? null, v.commune);
  const homeCode = await generateUniqueHomeCode();
  const now = new Date();
  const aine = await db.$transaction(async (tx) => {
    const created = await tx.aine.create({
      data: {
        firstName: v.firstName,
        lastInitial: v.lastInitial ?? null,
        commune: v.commune,
        addressHint: v.addressHint ?? null,
        // L1-B (L8) : adresse chiffrée et géocodée ; sinon centre de la commune (position approximative).
        addressEnc: home.addressEnc,
        latitude: home.latitude,
        longitude: home.longitude,
        locationApproximate: home.locationApproximate,
        geocodedAt: home.geocodedAt,
        phone: v.phone ?? null,
        needs: v.needs,
        activityLevel: v.activityLevel,
        consentGiven: true,
        consentByType: v.consentByType,
        consentByName: v.consentByName,
        consentAt: now,
        // Mode essai : données d'exemple, accord déclaré par la famille (R5 s'applique en lancement).
        accordEtat: "ACCORD_RECUEILLI",
        accordAt: now,
        homeCode,
        // Le profil appartient au même monde que la famille (bac à sable ou monde réel).
        sandboxId: user.sandboxId,
        ownerId: user.id,
        members: { create: { userId: user.id, relation: v.myRelation, isPayer: true } },
        subscription: { create: { payerId: user.id, plan: "LAKOU", priceCents: 0 } },
      },
      select: { id: true },
    });
    await logAudit({ actor: user, action: "aine.created", entityType: "Aine", entityId: created.id, metadata: { commune: v.commune, level: v.activityLevel, address: home.addressEnc !== null, approximate: home.locationApproximate } }, tx);
    await logAudit({ actor: user, action: "aine.consent", entityType: "Aine", entityId: created.id, metadata: { consentByType: v.consentByType } }, tx);
    return created;
  });
  revalidatePath("/famille");
  redirect(`/famille/aines/${aine.id}?cree=1`);
}

/**
 * R5 (J5), mode lancement : fiche MINIMALE (prénom, commune, téléphone) à l'état EN_ATTENTE_ACCORD.
 * Pas de besoin, pas d'adresse, pas d'accord saisi par la famille : un conseiller appelle l'aîné.
 */
async function createAineForConsent(user: Awaited<ReturnType<typeof requireRole>>, formData: FormData): Promise<ActionResult> {
  const parsed = aineLaunchCreateSchema.safeParse(formDataToObject(formData));
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
        commune: v.commune,
        latitude: commune.lat,
        longitude: commune.lng,
        phone: v.phone,
        needs: [],
        activityLevel: 1,
        // L'accord n'est PAS donné : le conseiller l'enregistre après l'appel.
        consentGiven: false,
        consentByType: "AINE",
        consentByName: "",
        consentAt: now,
        accordEtat: "EN_ATTENTE_ACCORD",
        homeCode,
        ownerId: user.id,
        members: { create: { userId: user.id, relation: v.myRelation, isPayer: true } },
        subscription: { create: { payerId: user.id, plan: "LAKOU", priceCents: 0 } },
      },
      select: { id: true },
    });
    await logAudit({ actor: user, action: "aine.created", entityType: "Aine", entityId: created.id, metadata: { commune: v.commune, accordEtat: "EN_ATTENTE_ACCORD" } }, tx);
    return created;
  });
  revalidatePath("/famille");
  redirect(`/famille/aines/${aine.id}?cree=1`);
}

/** F3 : modifie le profil. Seul le payeur (gestionnaire principal) modifie. */
export async function updateAineAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  try {
    assertRealDataAllowed();
  } catch (e) {
    if (e instanceof RealDataClosedError) return { ok: false, error: e.message };
    throw e;
  }
  const launch = isLaunchMode();
  const parsed = (launch ? aineLaunchUpdateSchema : aineUpdateSchema).safeParse(formDataToObject(formData, ["needs"]));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  // R5 : en lancement, l'accord vient du conseiller ; la famille ne le modifie jamais.
  const current = launch ? await db.aine.findUnique({ where: { id: parsed.data.aineId }, select: { consentByType: true, consentByName: true } }) : null;
  const v = { consentByType: current?.consentByType ?? "AINE", consentByName: current?.consentByName ?? "", ...parsed.data };
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
  // L1-B (L8) : l'adresse est chiffrée en base ; on compare le texte en clair.
  const newAddress = v.address ?? null;
  const addressChanged = (readAddress(before) ?? null) !== newAddress;
  if (addressChanged) changed.push("address");
  if (changed.length === 0) return { ok: true, message: "Aucune modification à enregistrer." };
  const consentChanged = changed.includes("consentByType") || changed.includes("consentByName");
  if (addressChanged && newAddress) {
    const refusal = addressRefusal(before);
    if (refusal) return { ok: false, error: CHECK_FIELDS, fieldErrors: { address: [refusal] } };
  }
  const home = addressChanged || changed.includes("commune") ? await computeHomeLocation(newAddress, v.commune) : null;

  await db.$transaction(async (tx) => {
    await tx.aine.update({
      where: { id: v.aineId },
      data: {
        ...next,
        ...(home
          ? {
              addressEnc: home.addressEnc,
              latitude: home.latitude,
              longitude: home.longitude,
              locationApproximate: home.locationApproximate,
              geocodedAt: home.geocodedAt,
            }
          : {}),
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
  // A6 : un lien « proche aidant » ne fait jamais entrer dans le cercle Lakou.
  if (!inv || inv.kind !== "LAKOU" || !sameScope(inv.aine.sandboxId, user.sandboxId)) return { ok: false, error: "Ce lien d'invitation n'est pas valide." };
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

// ─────────────────────────────── A6 : rattacher un proche aidant (D7) ───────────────────────────────

/**
 * A6 : le payeur crée un lien pour rattacher un PROCHE AIDANT (compte Accompagnant, statut PROCHE_AIDANT_APA)
 * à cet aîné. Après acceptation, Koudmen peut proposer ce proche aidant pour CET aîné seulement (D7).
 */
export async function inviteCaregiverRelativeAction(
  _prev: ActionResult<{ link: string; expiresAt: string }>,
  formData: FormData,
): Promise<ActionResult<{ link: string; expiresAt: string }>> {
  const user = await requireRole("FAMILLE");
  const parsed = caregiverLinkSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  const member = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId: parsed.data.aineId, userId: user.id } }, select: { isPayer: true } });
  if (!member) return { ok: false, error: NOT_FOUND };
  if (!member.isPayer) return { ok: false, error: "Seul le gestionnaire principal du profil peut rattacher un proche aidant." };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = invitationExpiry();
  const link = `${appUrl()}/proche-aidant/${token}`;
  await db.$transaction(async (tx) => {
    const inv = await tx.invitation.create({
      data: { aineId: parsed.data.aineId, token, kind: "PROCHE_AIDANT", relation: "proche aidant", createdById: user.id, expiresAt },
      select: { id: true },
    });
    // Jamais le jeton dans l'audit.
    await logAudit({ actor: user, action: "caregiver_link.invited", entityType: "Invitation", entityId: inv.id, metadata: { aineId: parsed.data.aineId } }, tx);
  });
  return {
    ok: true,
    message: "Lien créé. Envoyez-le à votre proche : il l'ouvre avec son compte Accompagnant (statut proche aidant).",
    data: { link, expiresAt: expiresAt.toISOString() },
  };
}

// ─────────────────────────────── F5 / F6 : demandes ───────────────────────────────

/** F6 : crée une demande d'accompagnement (statut OUVERTE). */
export async function createRequestAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = careRequestSchema(todayIso()).safeParse(formDataToObject(formData, ["slots"]));
  if (!parsed.success) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  if (!(await canAccessAine(user, v.aineId))) return { ok: false, error: NOT_FOUND, fieldErrors: { aineId: ["Choisissez un aîné de votre cercle."] } };
  // R5 (J5) : aucune demande tant que l'aîné n'a pas donné son accord au conseiller.
  const accord = await db.aine.findUnique({ where: { id: v.aineId }, select: { accordEtat: true } });
  if (accord && accord.accordEtat !== "ACCORD_RECUEILLI") {
    return { ok: false, error: ACCORD_MISSING, fieldErrors: { aineId: [ACCORD_MISSING] } };
  }

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

/**
 * F5 : annule une demande OUVERTE ou PROPOSEE (M5). Tout se passe dans UNE transaction (cancelCareRequest) :
 * statut relu sous verrou, profils proposés ET choisi annulés, accompagnant choisi prévenu.
 */
export async function cancelRequestAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = cancelRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  const req = await db.careRequest.findUnique({ where: { id: parsed.data.requestId }, select: { id: true, aineId: true, status: true } });
  if (!req || !(await canAccessAine(user, req.aineId))) return { ok: false, error: NOT_FOUND };
  if (!canCancelRequest(req.status)) return { ok: false, error: "Cette demande ne peut plus être annulée." };

  try {
    await cancelCareRequest(user, req.id);
  } catch (e) {
    if (e instanceof MatchingError) return { ok: false, error: e.message };
    throw e;
  }
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
  // m7 : étape clé D6 dans la mesure D15 (bac à sable seulement).
  if (user.sandboxId) await trackEvent(user, "profile.chosen");
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

  // L4 / R8 : en lancement, aucun paiement (ni réel, ni simulé). Formule payante = demande de rappel.
  if (isLaunchMode()) {
    if (v.plan !== "LAKOU") {
      try {
        const r = await requestActivation(user, { plan: v.plan, aineId: v.aineId });
        revalidatePath("/famille/formule");
        return { ok: true, message: r.created ? `Demande envoyée. Un conseiller Koudmen vous appelle pour la formule ${plan.name}. ${NO_PAYMENT_NOTICE}` : `Votre demande est déjà envoyée. Un conseiller Koudmen vous appelle.` };
      } catch (e) {
        if (e instanceof ActivationError) return { ok: false, error: e.message };
        throw e;
      }
    }
    await db.$transaction(async (tx) => {
      const sub = await tx.subscription.upsert({
        where: { aineId: v.aineId },
        create: { aineId: v.aineId, payerId: user.id, plan: "LAKOU", priceCents: 0 },
        update: { plan: "LAKOU", priceCents: 0, payerId: user.id, status: "ACTIVE", startedAt: new Date(), endedAt: null },
        select: { id: true },
      });
      await logAudit({ actor: user, action: "plan.changed", entityType: "Subscription", entityId: sub.id, metadata: { aineId: v.aineId, from: aine.subscription?.plan ?? null, to: "LAKOU" } }, tx);
    });
    revalidatePath("/famille/formule");
    return { ok: true, message: `Formule ${plan.name} activée pour ${aine.firstName}. Elle est gratuite.` };
  }

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
