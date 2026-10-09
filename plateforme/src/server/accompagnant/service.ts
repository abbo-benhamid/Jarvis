import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyLakou } from "@/server/outbox";
import { schedulePushFlush } from "@/server/notifications/push/service";
import { sameScope } from "@/server/scope";
import { isDemoMode, isLaunchMode } from "@/server/env";
import { orientCaregiver, type OrientationAnswers, type OrientationResult } from "@/server/rules/orientation";
import { PREINSCRIPTION_MESSAGE, realDataAllowed } from "@/server/launch";
import { ageInYears, allowedLevelsFor, canStatusDoLevel, statusIsPaid } from "@/server/rules/status-levels";
import { evaluateGps, GPS_FAILURE_MESSAGES, verifyHomeCode } from "@/server/visits/proof";
import { tokenFromQr } from "@/server/presence/qr-token";
import { resolveHomeCardToken } from "@/server/presence/home-card";
import { endTripForVisit } from "@/server/presence/trajet";
import { homePoint } from "@/server/presence/address";
import { PRESENCE_REFUSAL_MESSAGES, presenceRefusal, type PresenceGuardAine } from "@/server/visits/launch-guards";
import { recordProof, refreshVisitStatus } from "@/server/visits/service";
import { formatTime } from "@/lib/format";
import { lockCareRequests } from "@/server/matching/locks";
import { inTransaction } from "@/server/matching/service";
import { MOOD_LABELS } from "@/lib/labels";
import { planVisits } from "./schedule";
import { fuseauDe, isOuvert, territoireDeCommune } from "@/lib/territoires";
import { addressProofRequired } from "@/server/verifications/config";
import { l2TypesFor } from "@/server/verifications/rules";
import { VerificationError } from "@/server/verifications/errors";
import { writeItemStatus } from "@/server/verifications/transition";
import { ensureRequiredItems, l2Applies, loadProfile as loadVerificationProfile, submissionProblems } from "@/server/verifications/service";
import {
  MAX_CODE_ATTEMPTS,
  PLANCHER_SALARIE_CENTS,
  canDeclare,
  declarationProblem,
  canRedoOrientation,
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

/** L1d (D9) : PREINSCRIPTION (données réelles fermées), ACCORD_MANQUANT (accord absent, refusé ou retiré). */
export type AccompagnantErrorCode = "INTROUVABLE" | "INTERDIT" | "CONFLIT" | "INVALIDE" | "TARIF" | "PREINSCRIPTION" | "ACCORD_MANQUANT";

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
  // L1 : jamais de position simulée en mode lancement.
  if (isLaunchMode()) return false;
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
      aine: {
        select: {
          id: true,
          firstName: true,
          latitude: true,
          longitude: true,
          locationApproximate: true,
          homeGeoEnc: true,
          homeCode: true,
          sandboxId: true,
          accordEtat: true,
          consentGiven: true,
          consentAt: true,
        },
      },
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
 * L1d (D9, R1 et R5) : toute action qui touche les données d'un aîné (check-in, Kayé, brouillon) exige les données
 * réelles ouvertes (sauf bac à sable) ET l'accord de l'aîné recueilli. Refusé sinon, sans rien garder.
 */
export function assertAineDataOpen(aine: PresenceGuardAine): void {
  const refusal = presenceRefusal(aine);
  if (refusal === "DONNEES_REELLES_NON_AUTORISEES") throw new AccompagnantError(PREINSCRIPTION_MESSAGE, "PREINSCRIPTION");
  if (refusal === "ACCORD_MANQUANT") throw new AccompagnantError(PRESENCE_REFUSAL_MESSAGES.ACCORD_MANQUANT, "ACCORD_MANQUANT");
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
  // R6 (J26) : niveau 3 fermé sous 21 ans (date de naissance donnée à l'inscription).
  const age = profile.birthDate ? ageInYears(profile.birthDate) : null;
  const allowedLevels = status ? allowedLevelsFor(status, { hasDiploma: profile.hasDiploma, age }) : [];
  // L2 : éléments du monde réel (téléphone, adresse, entreprise) ajoutés selon le statut (ni bac à sable, ni démo).
  const owner = await db.user.findUnique({ where: { id: actor.id }, select: { sandboxId: true, isDemo: true } });
  const l2 = status && owner && l2Applies(owner) ? l2TypesFor(status, { addressProofRequired: addressProofRequired() }) : [];
  const required = [...new Set([...result.requiredVerifications, ...l2])];
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

  // T1 (T3) : la zone d'intervention est dans UN territoire, et ce territoire est OUVERT.
  const territoires = [...new Set(input.communes.map((c) => territoireDeCommune(c)))];
  if (territoires.some((t) => !t || !isOuvert(t))) {
    throw new AccompagnantError("Choisissez des communes d'un territoire où Koudmen est ouvert.", "INVALIDE");
  }
  if (territoires.length > 1) throw new AccompagnantError("Choisissez des communes d'un seul territoire.", "INVALIDE");
  const zoneTerritoire = territoires[0];

  await db.$transaction(async (tx) => {
    await tx.caregiverProfile.update({
      where: { id: profile.id },
      data: {
        ...(zoneTerritoire ? { territoire: zoneTerritoire } : {}),
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
          territoire: zoneTerritoire ?? null,
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
  const problem = declarationProblem(item.type, declaration);
  if (problem) throw new AccompagnantError(problem, "INVALIDE");
  try {
    // L2b (B1) : règle des transitions ; un élément refusé à deux opérateurs ou en revue ne se redéclare pas.
    await writeItemStatus(db, item, "DECLARE", "ACCOMPAGNANT", {
      // R6 (J6) : casier B3 → aucun texte stocké. L'accompagnant montre l'extrait au rendez-vous ; l'opérateur note « vu le ».
      data: { declaration: item.type === "CASIER_B3" ? null : declaration, declaredAt: new Date() },
    });
  } catch (e) {
    if (e instanceof VerificationError) throw new AccompagnantError(e.message, "CONFLIT");
    throw e;
  }
  await logAudit({
    actor,
    action: "verification.declared",
    entityType: "VerificationItem",
    entityId: item.id,
    metadata: { type: item.type },
  });
}

export async function submitForReview(actor: Actor) {
  const base = await getOrCreateProfile(actor.id);
  // L2 : éléments requis selon le statut (téléphone, identité, adresse, entreprise) ; règles dans server/verifications.
  const profile = await loadVerificationProfile(actor.id);
  const items = await ensureRequiredItems(profile);
  if (profile.validation === "EN_ATTENTE" || profile.validation === "VALIDE" || profile.validation === "A_COMPLETER") {
    throw new AccompagnantError("Votre demande est déjà envoyée.", "CONFLIT");
  }
  const problems = submissionProblems(profile, items, base.availabilities.length);
  if (problems.length > 0) {
    const missing = missingProfileItems({ ...profile, availabilityCount: base.availabilities.length }).map((m) => m.label);
    throw new AccompagnantError(
      missing.length > 0 ? `Votre profil n'est pas complet : ${missing.join(", ")}.` : `Avant la demande : ${problems.join(" ; ")}.`,
      "INVALIDE",
    );
  }
  const res = await db.caregiverProfile.updateMany({
    where: { id: profile.id, validation: { in: ["BROUILLON", "REFUSE"] } },
    data: { validation: "EN_ATTENTE", validationReason: null, refusalCode: null, refusalProposedById: null, refusalProposedAt: null },
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
        request: { include: { slots: true, aine: { select: { id: true, firstName: true, territoire: true } } } },
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
    // T1 (T3) : une mission seulement dans le territoire de l'accompagnant, et seulement s'il est OUVERT.
    if (request.aine.territoire !== cg.territoire || !isOuvert(request.aine.territoire)) {
      throw new AccompagnantError("Cette mission n'est pas dans votre territoire, ou Koudmen n'y est pas encore ouvert.", "INTERDIT");
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
        territoire: request.aine.territoire,
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
        timeZone: fuseauDe(request.aine.territoire),
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
  // L1d (D8, D9) : préinscription, accord absent, refusé ou retrait → aucun check-in (QR, code, position).
  assertAineDataOpen(visit.aine);
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
    // L6 : le trajet en direct s'arrête au check-in (la dernière position est effacée).
    await endTripForVisit(visit.id, "CHECK_IN", actor);
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
  /** Position simulée au domicile (bouton du mode test seulement). */
  simulated?: boolean;
  /** L10 : le téléphone signale une position simulée (`mocked` Android). Refusée : la preuve passe « À vérifier ». */
  mocked?: boolean;
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
      { lat: input.latitude, lng: input.longitude, accuracy: input.accuracy ?? null, mocked: input.mocked ?? false },
      // L1d (D3) : point précis déchiffré en mémoire seulement.
      homePoint(visit.aine),
    );
  }
  await markCheckIn(actor, visit, input.simulated ? "GPS_SIMULE" : "GPS", now);
  await recordProof(
    visit.id,
    {
      factor: "GPS",
      valid: evaluation.valid,
      simulated: input.simulated ?? false,
      // R7 : aucune coordonnée brute gardée. Seulement le résultat et la distance arrondie (dizaine de mètres).
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      distanceMeters: evaluation.distanceMeters,
      details: input.simulated
        ? "Position simulée au domicile (mode test)."
        : evaluation.reason
          ? GPS_FAILURE_MESSAGES[evaluation.reason]
          : null,
    },
    actor,
  );
  if (input.mocked) {
    await logAudit({ actor, action: "visit.gps.mocked", entityType: "Visit", entityId: visit.id });
  }
  return evaluation;
}

/** Messages du QR signé refusé (L10 : jeton faux ou révoqué → refusé). */
export const QR_REFUSAL_MESSAGES = {
  FAUX: "Ce QR code n'est pas une carte Koudmen valable. Entrez le code écrit sous le QR.",
  REVOQUE: "Cette carte domicile a été remplacée. Demandez la nouvelle carte à la famille.",
  AUTRE_DOMICILE: "Ce QR code est celui d'un autre domicile.",
} as const;

/**
 * Facteur (b) par le QR SIGNÉ de la carte domicile (L9, L10). Le jeton n'est jamais enregistré ni journalisé.
 * Jeton faux, révoqué (carte régénérée) ou d'un autre domicile → refus, compté comme un essai de code.
 */
export async function checkInWithQr(actor: Actor, visitId: string, qr: string, now: Date = new Date()) {
  const visit = await loadOwnedVisit(actor.id, visitId);
  assertActiveCaregiver(visit);
  assertCanAddProof(visit, now);
  if (visit.proofs.some((p) => p.factor === "CODE_DOMICILE" && p.valid)) {
    return { valid: true as const, alreadyDone: true };
  }
  const failures = await db.auditLog.count({ where: { action: "visit.code.failed", entityType: "Visit", entityId: visit.id } });
  if (failures >= MAX_CODE_ATTEMPTS) {
    throw new AccompagnantError("Trop d'essais pour le code. Demandez à la famille de confirmer votre visite.", "INTERDIT");
  }
  const token = tokenFromQr(qr);
  const resolution = token ? await resolveHomeCardToken(token) : ({ ok: false, reason: "FAUX" } as const);
  const refusal = !resolution.ok ? resolution.reason : resolution.aineId !== visit.aineId ? "AUTRE_DOMICILE" : null;
  if (refusal) {
    await logAudit({ actor, action: "visit.code.failed", entityType: "Visit", entityId: visit.id, metadata: { method: "QR", reason: refusal } });
    throw new AccompagnantError(QR_REFUSAL_MESSAGES[refusal], "INVALIDE");
  }
  await markCheckIn(actor, visit, "QR_SIGNE", now);
  await recordProof(visit.id, { factor: "CODE_DOMICILE", valid: true, details: "QR signé de la carte domicile scanné sur place." }, actor);
  return { valid: true as const, alreadyDone: false };
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
  // R1 : pas de Kayé réel en préinscription (données réelles des aînés fermées).
  if (!realDataAllowed()) throw new AccompagnantError(PREINSCRIPTION_MESSAGE, "PREINSCRIPTION");
  const visit = await loadOwnedVisit(actor.id, input.visitId);
  // L1d (D8, D9) : accord de l'aîné obligatoire (retrait → Kayé bloqués).
  assertAineDataOpen(visit.aine);
  assertActiveCaregiver(visit);
  if (visit.journal) throw new AccompagnantError("Le Kayé de cette visite existe déjà.", "CONFLIT");
  if (!canWriteKaye({ checkInAt: visit.checkInAt, hasJournal: false })) {
    throw new AccompagnantError("Faites d'abord le check-in de la visite.", "INVALIDE");
  }
  try {
    const created = await db.$transaction(async (tx) => {
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
      // M8 (RGPD) : le brouillon synchronisé par l'app ne sert plus, que le Kayé vienne du web ou de l'app.
      await tx.kayeDraft.deleteMany({ where: { visitId: visit.id } });
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
    // Lot N1 : push générique au cercle Lakou, après la validation de la transaction.
    // M2 : envoi APRÈS la réponse (jamais attendu par la requête métier).
    schedulePushFlush();
    return created;
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
