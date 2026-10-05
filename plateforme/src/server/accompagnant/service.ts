import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyLakou } from "@/server/outbox";
import { sameScope } from "@/server/scope";
import { isDemoMode } from "@/server/env";
import { orientCaregiver, type OrientationAnswers, type OrientationResult } from "@/server/rules/orientation";
import { allowedLevelsFor, canStatusDoLevel, statusIsPaid } from "@/server/rules/status-levels";
import { evaluateGps, verifyHomeCode } from "@/server/visits/proof";
import { recordProof, refreshVisitStatus } from "@/server/visits/service";
import { formatTime } from "@/lib/format";
import { lockCareRequests } from "@/server/matching/locks";
import { inTransaction } from "@/server/matching/service";
import { MOOD_LABELS } from "@/lib/labels";
import { planVisits } from "./schedule";
import {
  MAX_CODE_ATTEMPTS,
  PLANCHER_SALARIE_CENTS,
  canDeclare,
  canRedoOrientation,
  canSubmitForReview,
  canWriteKaye,
  checkInWindow,
  missingProfileItems,
  statusIsSalaried,
  visitAcceptsProof,
  type KayeInput,
  type ProfileInput,
} from "./rules";

/**
 * Logique métier du Lot B (accompagnant). Chaque fonction :
 * 1. reçoit l'acteur DÉJÀ authentifié (requireRole dans l'action) ;
 * 2. contrôle que la ressource appartient à cet accompagnant ;
 * 3. écrit, journalise (logAudit) et notifie (notifyLakou).
 */

export type Actor = { id: string; role: Role; firstName: string };

export type AccompagnantErrorCode = "INTROUVABLE" | "INTERDIT" | "CONFLIT" | "INVALIDE" | "TARIF";

/** Erreur métier : `message` s'affiche tel quel à l'accompagnant. */
export class AccompagnantError extends Error {
  constructor(
    message: string,
    public readonly code: AccompagnantErrorCode = "INVALIDE",
  ) {
    super(message);
    this.name = "AccompagnantError";
  }
}

/**
 * Mode test : bouton « Simuler ma position » et check-in hors horaire autorisés.
 * Actif PAR DÉFAUT pendant la phase de test (T9) ; désactivé seulement par NEXT_PUBLIC_TEST_MODE="false".
 */
export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_TEST_MODE !== "false" || isDemoMode();
}

// ─────────────────────────────── Propriété des ressources ───────────────────────────────

/** Filtre Prisma : la visite `visitId` appartient à l'accompagnant `userId`. */
export function ownedVisitWhere(userId: string, visitId: string) {
  return { id: visitId, caregiver: { userId } } satisfies Prisma.VisitWhereInput;
}

/** Filtre Prisma : la proposition appartient à l'accompagnant `userId`. */
export function ownedProposalWhere(userId: string, proposalId: string) {
  return { id: proposalId, caregiver: { userId } } satisfies Prisma.MissionProposalWhereInput;
}

/** Profil de l'accompagnant (créé vide s'il manque). */
export async function getOrCreateProfile(userId: string) {
  return db.caregiverProfile.upsert({
    where: { userId },
    create: { userId, allowedLevels: [], communes: [] },
    update: {},
    include: { availabilities: true, verifications: true },
  });
}

/** Visite de CET accompagnant, sinon erreur INTROUVABLE (même message qu'une visite inexistante). */
async function loadOwnedVisit(userId: string, visitId: string) {
  const visit = await db.visit.findFirst({
    where: ownedVisitWhere(userId, visitId),
    include: {
      aine: { select: { id: true, firstName: true, latitude: true, longitude: true, homeCode: true } },
      proofs: true,
      journal: { select: { id: true } },
      caregiver: { select: { validation: true } },
      mission: { select: { status: true } },
    },
  });
  if (!visit) throw new AccompagnantError("Visite introuvable.", "INTROUVABLE");
  return visit;
}

/**
 * A1 (M4) : un accompagnant suspendu ou refusé, ou une mission suspendue, n'a plus de check-in ni de Kayé.
 */
function assertActiveCaregiver(visit: { caregiver: { validation: string }; mission: { status: string } }) {
  if (visit.caregiver.validation !== "VALIDE") {
    throw new AccompagnantError("Votre profil n'est pas actif. Vous ne pouvez plus faire de check-in ni écrire de Kayé.", "INTERDIT");
  }
  if (visit.mission.status !== "ACTIVE") {
    throw new AccompagnantError("Cette mission est suspendue ou terminée. Vous ne pouvez plus faire de check-in ni écrire de Kayé.", "INTERDIT");
  }
}

// ─────────────────────────────── A2 — Orientation ───────────────────────────────

export async function saveOrientation(actor: Actor, answers: OrientationAnswers): Promise<OrientationResult> {
  const profile = await getOrCreateProfile(actor.id);
  if (!canRedoOrientation(profile.validation)) {
    throw new AccompagnantError(
      "Votre profil est validé. Pour changer de statut, contactez l'équipe Koudmen.",
      "INTERDIT",
    );
  }
  const result = orientCaregiver(answers);
  const status = result.status;
  // RM-03 : niveaux TOUJOURS recalculés côté serveur.
  const allowedLevels = status ? allowedLevelsFor(status, { hasDiploma: profile.hasDiploma }) : [];
  const required = result.requiredVerifications;
  // D10 (M1) : un nouveau statut salarié n'hérite jamais d'un tarif sous le plancher. Le tarif est effacé :
  // le profil redevient incomplet, l'accompagnant fixe un nouveau tarif.
  const keepRate =
    status !== "BENEVOLE_ASSO" &&
    !(statusIsSalaried(status) && profile.hourlyRateCents != null && profile.hourlyRateCents < PLANCHER_SALARIE_CENTS);

  await db.$transaction(async (tx) => {
    await tx.caregiverProfile.update({
      where: { id: profile.id },
      data: {
        status,
        orientationAnswers: answers as Prisma.InputJsonValue,
        allowedLevels,
        hourlyRateCents: keepRate ? profile.hourlyRateCents : null,
        // Un nouveau statut demande une nouvelle demande de vérification.
        validation: profile.validation === "EN_ATTENTE" ? "BROUILLON" : profile.validation,
      },
    });
    for (const type of required) {
      await tx.verificationItem.upsert({
        where: { caregiverId_type: { caregiverId: profile.id, type } },
        create: { caregiverId: profile.id, type, status: "A_FOURNIR" },
        update: {},
      });
    }
    await tx.verificationItem.deleteMany({
      where: { caregiverId: profile.id, type: { notIn: required }, status: { in: ["A_FOURNIR", "DECLARE"] } },
    });
    await logAudit(
      {
        actor,
        action: "caregiver.orientation",
        entityType: "CaregiverProfile",
        entityId: profile.id,
        metadata: { outcome: result.outcome, status },
      },
      tx,
    );
  });
  return result;
}

// ─────────────────────────────── A3 — Profil ───────────────────────────────

export async function saveProfile(actor: Actor, input: ProfileInput): Promise<{ warning?: string }> {
  const profile = await getOrCreateProfile(actor.id);
  const status = profile.status;
  if (!status) throw new AccompagnantError("Faites d'abord l'orientation (5 questions).", "INTERDIT");
  const paid = statusIsPaid(status);
  // RM-04 : le tarif vient de l'accompagnant seul.
  const hourlyRateCents = paid ? input.hourlyRate : null;
  // D10 : un salarié (CESU, proche aidant) ne peut pas être payé sous le SMIC ni sous le minimum IDCC 3239.
  if (statusIsSalaried(status) && hourlyRateCents != null && hourlyRateCents < PLANCHER_SALARIE_CENTS) {
    throw new AccompagnantError(
      `Votre tarif est sous le minimum légal d'un salarié (${(PLANCHER_SALARIE_CENTS / 100).toFixed(2).replace(".", ",")} € brut de l'heure). Augmentez votre tarif.`,
      "TARIF",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.caregiverProfile.update({
      where: { id: profile.id },
      data: {
        communes: input.communes,
        hourlyRateCents,
        bio: input.bio,
        associationName: status === "BENEVOLE_ASSO" ? input.associationName : null,
        saadName: status === "SAAD" ? input.saadName : null,
        siret: status === "AUTO_ENTREPRENEUR_SAP" ? input.siret : null,
      },
    });
    await tx.caregiverAvailability.deleteMany({ where: { caregiverId: profile.id } });
    if (input.availabilities.length > 0) {
      await tx.caregiverAvailability.createMany({
        data: input.availabilities.map((a) => ({ caregiverId: profile.id, ...a })),
      });
    }
    await logAudit(
      {
        actor,
        action: "caregiver.profile.updated",
        entityType: "CaregiverProfile",
        entityId: profile.id,
        metadata: {
          communes: input.communes.length,
          availabilities: input.availabilities.length,
          rateChanged: hourlyRateCents !== profile.hourlyRateCents,
        },
      },
      tx,
    );
  });

  return {};
}

// ─────────────────────────────── A4 — Vérifications ───────────────────────────────

export async function declareVerification(actor: Actor, itemId: string, declaration: string) {
  const item = await db.verificationItem.findFirst({ where: { id: itemId, caregiver: { userId: actor.id } } });
  if (!item) throw new AccompagnantError("Vérification introuvable.", "INTROUVABLE");
  if (!canDeclare(item.status)) throw new AccompagnantError("Cette vérification est déjà validée.", "CONFLIT");
  await db.verificationItem.update({
    where: { id: item.id },
    data: { status: "DECLARE", declaration, declaredAt: new Date() },
  });
  await logAudit({
    actor,
    action: "verification.declared",
    entityType: "VerificationItem",
    entityId: item.id,
    metadata: { type: item.type },
  });
}

export async function submitForReview(actor: Actor) {
  const profile = await getOrCreateProfile(actor.id);
  const snapshot = {
    status: profile.status,
    communes: profile.communes,
    availabilityCount: profile.availabilities.length,
    hourlyRateCents: profile.hourlyRateCents,
    associationName: profile.associationName,
    saadName: profile.saadName,
    siret: profile.siret,
  };
  if (!canSubmitForReview(profile.validation, snapshot, profile.verifications)) {
    const missing = missingProfileItems(snapshot).map((m) => m.label);
    throw new AccompagnantError(
      missing.length > 0
        ? `Votre profil n'est pas complet : ${missing.join(", ")}.`
        : "Déclarez d'abord toutes vos vérifications.",
      "INVALIDE",
    );
  }
  const res = await db.caregiverProfile.updateMany({
    where: { id: profile.id, validation: { in: ["BROUILLON", "REFUSE"] } },
    data: { validation: "EN_ATTENTE", validationReason: null },
  });
  if (res.count !== 1) throw new AccompagnantError("Votre demande est déjà envoyée.", "CONFLIT");
  await logAudit({ actor, action: "caregiver.submitted", entityType: "CaregiverProfile", entityId: profile.id });
}

// ─────────────────────────────── A5 — Propositions ───────────────────────────────

export type AcceptResult = { missionId: string; visitCount: number; cancelledCount: number };

/**
 * Accepte une proposition, en UNE transaction :
 * proposition ACCEPTEE → demande POURVUE → Mission (copie du tarif) → visites des 4 semaines
 * → autres propositions ANNULEE → audit → notification du cercle Lakou.
 * Toute erreur annule l'ensemble.
 */
export async function acceptProposal(
  actor: Actor,
  proposalId: string,
  now: Date = new Date(),
  client?: Prisma.TransactionClient,
): Promise<AcceptResult> {
  return inAccompagnantTransaction(client, async (tx) => {
    // m1 : verrou de la DEMANDE d'abord (même ordre que choisir, annuler, suspendre).
    const ref = await tx.missionProposal.findFirst({ where: ownedProposalWhere(actor.id, proposalId), select: { requestId: true } });
    if (!ref) throw new AccompagnantError("Proposition introuvable.", "INTROUVABLE");
    await lockCareRequests(tx, [ref.requestId]);
    const proposal = await tx.missionProposal.findFirst({
      where: ownedProposalWhere(actor.id, proposalId),
      include: {
        caregiver: true,
        request: { include: { slots: true, aine: { select: { id: true, firstName: true } } } },
      },
    });
    if (!proposal) throw new AccompagnantError("Proposition introuvable.", "INTROUVABLE");
    if (proposal.status !== "EN_ATTENTE") {
      throw new AccompagnantError("Cette proposition n'est plus en attente.", "CONFLIT");
    }
    const cg = proposal.caregiver;
    const request = proposal.request;
    if (cg.validation !== "VALIDE" || !cg.status) {
      throw new AccompagnantError("Votre profil doit être validé pour accepter une mission.", "INTERDIT");
    }
    if (!canStatusDoLevel(cg.status, request.level, { hasDiploma: cg.hasDiploma })) {
      throw new AccompagnantError("Votre statut ne permet pas ce niveau d'accompagnement.", "INTERDIT");
    }
    const paid = statusIsPaid(cg.status);
    if (paid && cg.hourlyRateCents == null) {
      throw new AccompagnantError("Fixez d'abord votre tarif horaire dans votre profil.", "INVALIDE");
    }
    // D10 (M1) : la mission copie le tarif. Un salarié n'est jamais payé sous le plancher légal.
    if (statusIsSalaried(cg.status) && cg.hourlyRateCents != null && cg.hourlyRateCents < PLANCHER_SALARIE_CENTS) {
      throw new AccompagnantError(
        `Votre tarif est sous le minimum légal d'un salarié (${(PLANCHER_SALARIE_CENTS / 100).toFixed(2).replace(".", ",")} € brut de l'heure). Augmentez votre tarif dans votre profil.`,
        "TARIF",
      );
    }

    // La demande d'abord (déjà verrouillée), puis la proposition : une seule acceptation possible.
    const r = await tx.careRequest.updateMany({
      where: { id: request.id, status: { in: ["PROPOSEE", "OUVERTE"] } },
      data: { status: "POURVUE" },
    });
    if (r.count !== 1) throw new AccompagnantError("Cette demande n'est plus disponible.", "CONFLIT");
    const p = await tx.missionProposal.updateMany({
      where: { id: proposal.id, status: "EN_ATTENTE" },
      data: { status: "ACCEPTEE", respondedAt: now },
    });
    if (p.count !== 1) throw new AccompagnantError("Cette proposition n'est plus en attente.", "CONFLIT");

    const mission = await tx.mission.create({
      data: {
        requestId: request.id,
        proposalId: proposal.id,
        aineId: request.aineId,
        caregiverId: cg.id,
        hourlyRateCents: paid ? cg.hourlyRateCents : null,
        // D6 : l'employeur (ou client) déclaré par la famille dans la demande.
        employerType: request.employerType,
        employerName: request.employerName,
      },
    });

    const planned = planVisits(
      {
        frequency: request.frequency,
        durationMinutes: request.durationMinutes,
        startDate: request.startDate,
        slots: request.slots,
      },
      now,
    );
    if (planned.length > 0) {
      await tx.visit.createMany({
        data: planned.map((v) => ({
          missionId: mission.id,
          aineId: request.aineId,
          caregiverId: cg.id,
          scheduledStart: v.scheduledStart,
          scheduledEnd: v.scheduledEnd,
        })),
      });
    }

    // Les autres profils proposés à la famille (ou choisis) ne servent plus.
    const cancelled = await tx.missionProposal.updateMany({
      where: { requestId: request.id, id: { not: proposal.id }, status: { in: ["EN_ATTENTE", "PROPOSEE_FAMILLE"] } },
      data: { status: "ANNULEE", respondedAt: now },
    });

    await logAudit(
      {
        actor,
        action: "proposal.accepted",
        entityType: "MissionProposal",
        entityId: proposal.id,
        metadata: { missionId: mission.id, visits: planned.length, cancelledProposals: cancelled.count },
      },
      tx,
    );
    await notifyLakou(
      request.aineId,
      "PROPOSITION_ACCEPTEE",
      { accompagnant: actor.firstName, aine: request.aine.firstName },
      { type: "Mission", id: mission.id },
      tx,
    );
    return { missionId: mission.id, visitCount: planned.length, cancelledCount: cancelled.count };
  });
}

/** Transaction du Lot B : conflits de concurrence (deadlock, sérialisation) traduits en CONFLIT (m1). */
async function inAccompagnantTransaction<T>(client: Prisma.TransactionClient | undefined, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await inTransaction(client, fn, "Cette proposition a changé entre-temps. Rechargez la page.");
  } catch (e) {
    if (e instanceof Error && e.name === "MatchingError") throw new AccompagnantError(e.message, "CONFLIT");
    throw e;
  }
}

/**
 * Refuse une proposition. RM-05 : AUCUN effet sur le profil (pas de compteur, pas de baisse de visibilité).
 * La note est facultative et n'est jamais transmise à la famille.
 */
export async function declineProposal(actor: Actor, proposalId: string, declineNote: string | null, now: Date = new Date()) {
  return inAccompagnantTransaction(undefined, async (tx) => {
    const ref = await tx.missionProposal.findFirst({ where: ownedProposalWhere(actor.id, proposalId), select: { requestId: true } });
    if (!ref) throw new AccompagnantError("Proposition introuvable.", "INTROUVABLE");
    await lockCareRequests(tx, [ref.requestId]);
    const proposal = await tx.missionProposal.findFirst({
      where: ownedProposalWhere(actor.id, proposalId),
      include: { request: { include: { aine: { select: { id: true, firstName: true } } } } },
    });
    if (!proposal) throw new AccompagnantError("Proposition introuvable.", "INTROUVABLE");
    const p = await tx.missionProposal.updateMany({
      where: { id: proposal.id, status: "EN_ATTENTE" },
      data: { status: "REFUSEE", declineNote, respondedAt: now },
    });
    if (p.count !== 1) throw new AccompagnantError("Cette proposition n'est plus en attente.", "CONFLIT");

    // Plus aucun profil à choisir ni en attente → la demande redevient OUVERTE (spec § 4.2).
    // S'il reste des profils proposés, la famille en choisit un autre (D6).
    const remaining = await tx.missionProposal.count({
      where: { requestId: proposal.requestId, status: { in: ["PROPOSEE_FAMILLE", "EN_ATTENTE", "ACCEPTEE"] } },
    });
    let reopened = false;
    if (remaining === 0) {
      const r = await tx.careRequest.updateMany({
        where: { id: proposal.requestId, status: "PROPOSEE" },
        data: { status: "OUVERTE" },
      });
      reopened = r.count === 1;
    }
    await logAudit(
      {
        actor,
        action: "proposal.declined",
        entityType: "MissionProposal",
        entityId: proposal.id,
        metadata: { hasNote: declineNote !== null, requestReopened: reopened },
      },
      tx,
    );
    // Message ANONYME : la famille ne sait pas qui refuse ni pourquoi (RM-05).
    await notifyLakou(
      proposal.request.aineId,
      "PROPOSITION_REFUSEE",
      { aine: proposal.request.aine.firstName },
      { type: "MissionProposal", id: proposal.id },
      tx,
    );
    return { reopened };
  });
}

// ─────────────────────────────── A7 — Check-in / check-out ───────────────────────────────

function assertCanAddProof(visit: Awaited<ReturnType<typeof loadOwnedVisit>>, now: Date) {
  if (!visitAcceptsProof(visit)) {
    throw new AccompagnantError("Cette visite est terminée. Vous ne pouvez plus faire de check-in.", "CONFLIT");
  }
  const w = checkInWindow(visit, now, isTestMode());
  if (w === "TROP_TOT") throw new AccompagnantError("Le check-in s'ouvre 2 heures avant le début de la visite.", "INVALIDE");
  if (w === "TROP_TARD") throw new AccompagnantError("Le délai de check-in de cette visite est dépassé.", "INVALIDE");
}

/** Pose checkInAt au premier facteur. Retourne true si c'est le premier check-in. */
async function markCheckIn(actor: Actor, visit: Awaited<ReturnType<typeof loadOwnedVisit>>, method: string, now: Date) {
  const res = await db.visit.updateMany({ where: { id: visit.id, checkInAt: null }, data: { checkInAt: now } });
  if (res.count === 1) {
    await logAudit({ actor, action: "visit.checkin", entityType: "Visit", entityId: visit.id, metadata: { method } });
    await notifyLakou(
      visit.aineId,
      "VISITE_COMMENCEE",
      { accompagnant: actor.firstName, aine: visit.aine.firstName, heure: formatTime(now) },
      { type: "Visit", id: visit.id },
    );
    return true;
  }
  return false;
}

/** RM-08 (m3) : 2 lectures de position au plus par visite (une erreur de réseau ou de précision est permise). */
export const MAX_GPS_ATTEMPTS = 2;

export type GpsCheckInInput = {
  visitId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  /** Position simulée au domicile (mode test seulement). */
  simulated?: boolean;
};

/**
 * Facteur (a) GPS. RM-08 : UNE position, au check-in, avec l'accord explicite de l'accompagnant.
 * Une position valide n'est jamais relue. Pas de suivi, pas de position au check-out.
 */
export async function checkInWithGps(actor: Actor, input: GpsCheckInInput, now: Date = new Date()) {
  const visit = await loadOwnedVisit(actor.id, input.visitId);
  assertActiveCaregiver(visit);
  assertCanAddProof(visit, now);
  if (visit.proofs.some((p) => p.factor === "GPS" && p.valid)) {
    throw new AccompagnantError("Votre position est déjà enregistrée pour cette visite.", "CONFLIT");
  }
  // RM-08 (m3) : pas de suivi. Au plus MAX_GPS_ATTEMPTS lectures de position par visite, valides ou non.
  const gpsAttempts = await db.auditLog.count({ where: { action: "visit.gps.attempt", entityType: "Visit", entityId: visit.id } });
  if (gpsAttempts >= MAX_GPS_ATTEMPTS) {
    throw new AccompagnantError("Votre position a déjà été lue pour cette visite. Utilisez le code du domicile.", "INTERDIT");
  }
  await logAudit({ actor, action: "visit.gps.attempt", entityType: "Visit", entityId: visit.id, metadata: { simulated: input.simulated ?? false } });
  let evaluation: ReturnType<typeof evaluateGps>;
  if (input.simulated) {
    if (!isTestMode()) throw new AccompagnantError("La simulation est possible seulement en mode test.", "INTERDIT");
    evaluation = { valid: true, distanceMeters: 0 };
  } else {
    if (input.latitude == null || input.longitude == null) throw new AccompagnantError("Position manquante.", "INVALIDE");
    evaluation = evaluateGps(
      { lat: input.latitude, lng: input.longitude, accuracy: input.accuracy ?? null },
      { lat: visit.aine.latitude, lng: visit.aine.longitude },
    );
  }
  await markCheckIn(actor, visit, input.simulated ? "GPS_SIMULE" : "GPS", now);
  await recordProof(
    visit.id,
    {
      factor: "GPS",
      valid: evaluation.valid,
      simulated: input.simulated ?? false,
      latitude: input.simulated ? null : input.latitude,
      longitude: input.simulated ? null : input.longitude,
      accuracyMeters: input.simulated ? null : (input.accuracy ?? null),
      distanceMeters: evaluation.distanceMeters,
      details: input.simulated
        ? "Position simulée au domicile (mode test)."
        : evaluation.reason === "TROP_LOIN"
          ? "Position trop loin du domicile."
          : evaluation.reason === "PRECISION_FAIBLE"
            ? "Position trop imprécise."
            : null,
    },
    actor,
  );
  return evaluation;
}

/** Facteur (b) code domicile. Le code saisi n'est jamais enregistré ni journalisé. */
export async function checkInWithCode(actor: Actor, visitId: string, code: string, now: Date = new Date()) {
  const visit = await loadOwnedVisit(actor.id, visitId);
  assertActiveCaregiver(visit);
  assertCanAddProof(visit, now);
  if (visit.proofs.some((p) => p.factor === "CODE_DOMICILE" && p.valid)) {
    return { valid: true as const, alreadyDone: true };
  }
  const failures = await db.auditLog.count({ where: { action: "visit.code.failed", entityType: "Visit", entityId: visit.id } });
  if (failures >= MAX_CODE_ATTEMPTS) {
    throw new AccompagnantError(
      "Trop d'essais pour le code. Demandez à la famille de confirmer votre visite.",
      "INTERDIT",
    );
  }
  if (!verifyHomeCode(code, visit.aine.homeCode)) {
    await logAudit({ actor, action: "visit.code.failed", entityType: "Visit", entityId: visit.id });
    const left = MAX_CODE_ATTEMPTS - failures - 1;
    throw new AccompagnantError(
      left > 0
        ? `Le code n'est pas correct. Il vous reste ${left} essai${left > 1 ? "s" : ""}.`
        : "Le code n'est pas correct. Demandez à la famille de confirmer votre visite.",
      "INVALIDE",
    );
  }
  await markCheckIn(actor, visit, "CODE_DOMICILE", now);
  await recordProof(visit.id, { factor: "CODE_DOMICILE", valid: true, details: "Code saisi sur place." }, actor);
  return { valid: true as const, alreadyDone: false };
}

/** Check-out : aucune position lue. Recalcule le statut (VALIDEE ou A_VERIFIER). */
export async function checkOut(actor: Actor, visitId: string, now: Date = new Date()) {
  const visit = await loadOwnedVisit(actor.id, visitId);
  if (!visit.checkInAt) throw new AccompagnantError("Faites d'abord le check-in.", "INVALIDE");
  const res = await db.visit.updateMany({ where: { id: visit.id, checkOutAt: null }, data: { checkOutAt: now } });
  if (res.count !== 1) throw new AccompagnantError("Le check-out est déjà fait.", "CONFLIT");
  const updated = await refreshVisitStatus(visit.id, now);
  await logAudit({
    actor,
    action: "visit.checkout",
    entityType: "Visit",
    entityId: visit.id,
    metadata: { score: updated.proofScore, status: updated.status },
  });
  return { status: updated.status, score: updated.proofScore };
}

// ─────────────────────────────── A8 — Kayé ───────────────────────────────

/** Un Kayé par visite, après le check-in. Notifie le cercle Lakou (sans donnée de santé). */
export async function createKaye(actor: Actor, input: KayeInput) {
  const visit = await loadOwnedVisit(actor.id, input.visitId);
  assertActiveCaregiver(visit);
  if (visit.journal) throw new AccompagnantError("Le Kayé de cette visite existe déjà.", "CONFLIT");
  if (!canWriteKaye({ checkInAt: visit.checkInAt, hasJournal: false })) {
    throw new AccompagnantError("Faites d'abord le check-in de la visite.", "INVALIDE");
  }
  try {
    return await db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          visitId: visit.id,
          aineId: visit.aineId,
          authorId: actor.id,
          mood: input.mood,
          activities: input.activities,
          appetite: input.appetite,
          note: input.note,
          alertFlag: input.alertFlag,
          alertNote: input.alertNote,
        },
      });
      // Jamais le texte du Kayé dans l'audit.
      await logAudit(
        { actor, action: "journal.created", entityType: "JournalEntry", entityId: entry.id, metadata: { alertFlag: input.alertFlag } },
        tx,
      );
      const vars = { aine: visit.aine.firstName, accompagnant: actor.firstName, humeur: MOOD_LABELS[input.mood] ?? "" };
      await notifyLakou(visit.aineId, "KAYE_PUBLIE", vars, { type: "Visit", id: visit.id }, tx);
      if (input.alertFlag) {
        await notifyLakou(visit.aineId, "ALERTE_A_SURVEILLER", vars, { type: "Visit", id: visit.id }, tx);
      }
      return entry;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AccompagnantError("Le Kayé de cette visite existe déjà.", "CONFLIT");
    }
    throw e;
  }
}

// ─────────────────────────────── A6 — Proche aidant rattaché à son aîné (D7) ───────────────────────────────

/**
 * Le proche aidant ouvre le lien créé par le payeur. Contrôles serveur :
 * - lien de type PROCHE_AIDANT, valide, pas encore utilisé, du MÊME monde (D2) ;
 * - le compte est un accompagnant au statut PROCHE_AIDANT_APA (D7 : statut réservé à son propre parent).
 * Effet : linkedAineId = cet aîné. Le lien sert une seule fois. Le cercle Lakou est prévenu.
 */
export async function linkCaregiverToAine(
  actor: Actor & { sandboxId: string | null },
  token: string,
  now: Date = new Date(),
  client?: Prisma.TransactionClient,
): Promise<{ aineId: string; aineFirstName: string }> {
  const run = async (tx: Prisma.TransactionClient) => {
    const inv = await tx.invitation.findUnique({
      where: { token },
      select: { id: true, kind: true, aineId: true, acceptedAt: true, expiresAt: true, aine: { select: { firstName: true, sandboxId: true } } },
    });
    if (!inv || inv.kind !== "PROCHE_AIDANT" || !sameScope(inv.aine.sandboxId, actor.sandboxId)) {
      throw new AccompagnantError("Ce lien n'est pas valable.", "INTROUVABLE");
    }
    if (inv.acceptedAt) throw new AccompagnantError("Ce lien a déjà été utilisé. Demandez un nouveau lien à la famille.", "CONFLIT");
    if (inv.expiresAt.getTime() <= now.getTime()) throw new AccompagnantError("Ce lien a expiré. Demandez un nouveau lien à la famille.", "INVALIDE");
    const profile = await tx.caregiverProfile.findUnique({ where: { userId: actor.id }, select: { id: true, status: true, linkedAineId: true } });
    if (!profile || profile.status !== "PROCHE_AIDANT_APA") {
      throw new AccompagnantError(
        "Ce lien sert seulement à un proche aidant. Faites d'abord l'orientation : à la question sur le lien familial, répondez « Enfant ou parent ».",
        "INTERDIT",
      );
    }
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, acceptedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: actor.id },
    });
    if (claimed.count !== 1) throw new AccompagnantError("Ce lien a déjà été utilisé. Demandez un nouveau lien à la famille.", "CONFLIT");
    await tx.caregiverProfile.update({ where: { id: profile.id }, data: { linkedAineId: inv.aineId } });
    await logAudit(
      {
        actor,
        action: "caregiver.linked_aine",
        entityType: "CaregiverProfile",
        entityId: profile.id,
        metadata: { aineId: inv.aineId, invitationId: inv.id, replaced: profile.linkedAineId !== null && profile.linkedAineId !== inv.aineId },
      },
      tx,
    );
    await notifyLakou(inv.aineId, "PROCHE_AIDANT_RATTACHE", { accompagnant: actor.firstName, aine: inv.aine.firstName }, { type: "CaregiverProfile", id: profile.id }, tx);
    return { aineId: inv.aineId, aineFirstName: inv.aine.firstName };
  };
  return client ? run(client) : db.$transaction(run);
}
