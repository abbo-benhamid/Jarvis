import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/server/db";
import { isLaunchMode } from "@/server/config-check";
import { PREINSCRIPTION_MESSAGE, realDataAllowed } from "@/server/launch";
import { presenceRefusal } from "./launch-guards";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { formatTime } from "@/lib/format";
import { communeLabel, fuseauDe } from "@/lib/territoires";
import {
  AccompagnantError,
  assertAineDataOpen,
  checkInWithCode,
  checkInWithQr,
  checkInWithGps,
  checkOut,
  createKaye,
  getOrCreateProfile,
  isTestMode,
  ownedProposalWhere,
  ownedVisitWhere,
  type Actor,
} from "@/server/accompagnant/service";
import { getPendingProposals } from "@/server/accompagnant/queries";
import { refreshVisitStatus, sweepOverdueVisits } from "./service";
import { APP_VISIT_SELECT, effectiveEventTime, isClockSkewed, motifFromServiceCode, toVisiteDto } from "./app-rules";
import { GPS_FAILURE_MESSAGES } from "./proof";
import {
  brouillonKayeSchema,
  ECART_RECEPTION_CHECKIN_MAX_MIN,
  type Evenement,
  type ReponseVisite,
  type ResultatEvenement,
  type Visite,
} from "@/contracts/v1/visits";
import type { Proposition } from "@/contracts/v1/visits-propositions";

/**
 * Lot A2 (ADR 0008) : services de l'API v1 pour l'app accompagnant.
 * Ils RÉUTILISENT le Lot B (`src/server/accompagnant/service.ts`) : mêmes contrôles de propriété
 * (ownedVisitWhere), mêmes règles (fenêtre de check-in, essais de code, 2 lectures de position au plus,
 * profil actif), mêmes journaux et notifications que le web.
 */

/** L'accompagnant connecté (jeton d'accès déjà vérifié). */
export type AppUser = { id: string; role: Role; firstName: string; sandboxId: string | null; isDemo?: boolean };

const H = 3_600_000;

// ─────────────── GET /visites, GET /visites/:id ───────────────

/** Visites de l'accompagnant : de 12 h avant maintenant à `jours` jours après. Ordre chronologique. */
export async function listAppVisits(userId: string, jours: number, now: Date = new Date()): Promise<Visite[]> {
  const profile = await getOrCreateProfile(userId);
  // Statut cohérent partout : les visites dépassées passent « À vérifier » en base (comme le web).
  await sweepOverdueVisits({ caregiverId: profile.id }, now);
  const rows = await db.visit.findMany({
    where: {
      caregiverId: profile.id,
      scheduledStart: { gte: new Date(now.getTime() - 12 * H), lte: new Date(now.getTime() + jours * 24 * H) },
    },
    orderBy: { scheduledStart: "asc" },
    take: 100,
    select: APP_VISIT_SELECT,
  });
  const testMode = isTestMode();
  // L1d (D9) : aucune donnée d'aîné en préinscription, ni sans accord recueilli (ou après un retrait).
  return rows.filter((r) => presenceRefusal(r.aine) === null).map((r) => toVisiteDto(r, now, testMode));
}

/** Une visite de CET accompagnant (null sinon : même réponse qu'une visite inexistante). */
export async function getAppVisit(userId: string, visitId: string, now: Date = new Date()): Promise<ReponseVisite | null> {
  const row = await db.visit.findFirst({
    where: ownedVisitWhere(userId, visitId),
    select: { ...APP_VISIT_SELECT, kayeDraft: { select: { content: true } } },
  });
  // L1d (D9) : même réponse qu'une visite inconnue en préinscription ou sans accord de l'aîné.
  if (!row || presenceRefusal(row.aine) !== null) return null;
  const draft = row.journal === null && row.kayeDraft ? brouillonKayeSchema.safeParse(row.kayeDraft.content) : null;
  return { ...toVisiteDto(row, now, isTestMode()), brouillonKaye: draft?.success ? draft.data : null };
}

// ─────────────── POST /evenements ───────────────

const CONSIGNE_SOS = "Si une personne est en danger, appelez le 15 (SAMU) ou le 112 maintenant. L'équipe Koudmen est prévenue.";

type Outcome = Omit<ResultatEvenement, "clientEventId" | "type" | "horlogeSuspecte">;

function refused(e: AccompagnantError): Outcome {
  return { statut: "REFUSE", motif: motifFromServiceCode(e.code), message: e.message };
}

/**
 * Traite un lot d'événements, DANS L'ORDRE. Idempotent par (compte, clientEventId) :
 * un doublon renvoie le résultat d'origine sans rien refaire.
 * Un refus métier est enregistré (un renvoi ne consomme pas un nouvel essai de code).
 * Une erreur inattendue efface la réservation de l'événement (un renvoi le retraitera) et remonte (500).
 * Écart d'horloge > 12 h : la visite passe « À vérifier » APRÈS le lot (les autres événements du lot restent possibles).
 */
export async function processAppEvents(user: AppUser, events: Evenement[], receivedAt: Date = new Date()): Promise<ResultatEvenement[]> {
  const actor: Actor = { id: user.id, role: user.role, firstName: user.firstName };
  const profile = await db.caregiverProfile.findUnique({ where: { userId: user.id }, select: { validation: true } });
  const active = profile?.validation === "VALIDE";
  const skewedVisits = new Set<string>();
  const lateVisits = new Set<string>();
  const results: ResultatEvenement[] = [];

  for (const e of events) {
    const occurredAt = new Date(e.survenuA);
    const skew = isClockSkewed(occurredAt, receivedAt);
    const visitId = e.visiteId ?? null;
    let claimId: string;
    try {
      const claim = await db.appEvent.create({
        data: { userId: user.id, clientEventId: e.clientEventId, type: e.type, visitId, occurredAt, receivedAt, clockSkew: skew },
        select: { id: true },
      });
      claimId = claim.id;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      // M1 : une réservation sans résultat depuis plus de 60 s est orpheline (processus arrêté) : on la reprend.
      const resumed = await resumeStaleClaim(user.id, e.clientEventId, receivedAt);
      if (!resumed) {
        results.push(await duplicateResult(user.id, e));
        continue;
      }
      claimId = resumed;
    }

    let result: ResultatEvenement;
    try {
      // L1-B (P1/P8) : check-in reçu plus de 30 min après l'heure de l'appareil (l'écart > 12 h est déjà traité à part).
      const late = e.type === "CHECK_IN" && !skew && isLateCheckIn(occurredAt, receivedAt);
      const outcome = await handleEvent(actor, user, e, active, effectiveEventTime(occurredAt, receivedAt), skew, late);
      const visite = visitId ? await visitState(user.id, visitId) : undefined;
      // Code m3 : seule une PREUVE acceptée (check-in, check-out) à l'horloge suspecte marque la visite.
      // Un SOS, un brouillon ou un refus garde l'écart dans AppEvent sans bloquer la visite.
      if (skew && visite && outcome.statut === "ACCEPTE" && (e.type === "CHECK_IN" || e.type === "CHECK_OUT")) skewedVisits.add(visite.id);
      if (late && visite && outcome.statut === "ACCEPTE") lateVisits.add(visite.id);
      // La visite peut être prouvée par un facteur reçu avant (ex. code, puis position) : VALIDE.
      if (e.type === "CHECK_IN" && outcome.statut === "ACCEPTE" && !late && !skew && (visite?.statut === "VALIDEE" || visite?.statut === "PRESENCE_PROBABLE") && outcome.controle?.statut === "A_VERIFIER") {
        outcome.controle = { statut: "VALIDE", raison: "Présence confirmée : deux preuves sur trois." };
      }
      if (skew && outcome.controle?.statut === "VALIDE") {
        outcome.controle = {
          statut: "A_VERIFIER",
          raison: "L'heure du téléphone est très différente de l'heure réelle. La famille employeur confirmera la visite.",
        };
      }
      result = { clientEventId: e.clientEventId, type: e.type, horlogeSuspecte: skew, ...outcome, ...(visite ? { visite } : {}) };
      // Sécurité m1 : on garde l'id de visite seulement s'il appartient à ce compte (sinon null).
      await db.appEvent.update({
        where: { id: claimId },
        data: { outcome: result as unknown as Prisma.InputJsonValue, visitId: visite?.id ?? null },
      });
    } catch (err) {
      await db.appEvent.delete({ where: { id: claimId } }).catch(() => undefined);
      throw err;
    }
    results.push(result);
  }

  if (skewedVisits.size > 0 || lateVisits.size > 0) {
    for (const id of skewedVisits) await flagClockSkew(actor, id, receivedAt);
    for (const id of lateVisits) await flagLateCheckIn(actor, id, receivedAt);
    for (const r of results) {
      if (r.visite && (skewedVisits.has(r.visite.id) || lateVisits.has(r.visite.id)) && r.statut !== "DOUBLON") {
        r.visite = (await visitState(user.id, r.visite.id)) ?? r.visite;
      }
    }
  }
  return results;
}

/** M1 : durée après laquelle une réservation sans résultat (`outcome` null) peut être reprise. */
export const CLAIM_TIMEOUT_MS = 60_000;

/**
 * Reprend une réservation orpheline : `outcome` null et réservée depuis plus de CLAIM_TIMEOUT_MS.
 * Mise à jour conditionnelle : un seul renvoi gagne la reprise. Les services métier refusent déjà
 * les vrais doublons (Kayé unique, check-out unique, preuve déjà validée).
 */
async function resumeStaleClaim(userId: string, clientEventId: string, now: Date): Promise<string | null> {
  const prev = await db.appEvent.findUnique({
    where: { userId_clientEventId: { userId, clientEventId } },
    select: { id: true, outcome: true, receivedAt: true },
  });
  if (!prev || prev.outcome !== null || now.getTime() - prev.receivedAt.getTime() <= CLAIM_TIMEOUT_MS) return null;
  const r = await db.appEvent.updateMany({
    where: { id: prev.id, outcome: { equals: Prisma.DbNull }, receivedAt: prev.receivedAt },
    data: { receivedAt: now },
  });
  return r.count === 1 ? prev.id : null;
}

async function duplicateResult(userId: string, e: Evenement): Promise<ResultatEvenement> {
  const prev = await db.appEvent.findUnique({
    where: { userId_clientEventId: { userId, clientEventId: e.clientEventId } },
    select: { type: true, clockSkew: true, outcome: true },
  });
  const outcome = prev?.outcome as ResultatEvenement | null | undefined;
  if (!outcome) {
    return { clientEventId: e.clientEventId, type: e.type, statut: "DOUBLON", statutOrigine: "EN_COURS", horlogeSuspecte: prev?.clockSkew ?? false };
  }
  const origine = outcome.statut === "REFUSE" ? "REFUSE" : "ACCEPTE";
  return { ...outcome, statut: "DOUBLON", statutOrigine: origine };
}

async function visitState(userId: string, visitId: string) {
  const v = await db.visit.findFirst({ where: ownedVisitWhere(userId, visitId), select: { id: true, status: true, proofScore: true } });
  return v ? { id: v.id, statut: v.status, score: v.proofScore } : undefined;
}

async function handleEvent(actor: Actor, user: AppUser, e: Evenement, active: boolean, at: Date, skew: boolean, late = false): Promise<Outcome> {
  // Sécurité avant tout : le SOS passe toujours, même pour un profil inactif.
  if (e.type === "SOS") return sos(actor, user, e.visiteId ?? null, at, skew);
  // L1d (D9, code M1) : en préinscription, AUCUN événement ne touche une donnée d'aîné réelle (check-in, Kayé,
  // brouillon). Motif dédié ; rien n'est gardé, pas même en brouillon.
  if (user.sandboxId === null && !realDataAllowed()) {
    return { statut: "REFUSE", motif: "PREINSCRIPTION", message: PREINSCRIPTION_MESSAGE };
  }
  if (!active) {
    return {
      statut: "REFUSE",
      motif: "COMPTE_INACTIF",
      message: "Votre profil n'est pas actif. Vous ne pouvez plus faire de check-in ni écrire de Kayé.",
    };
  }
  try {
    switch (e.type) {
      case "CHECK_IN":
        return await checkIn(actor, e, at, late);
      case "CHECK_OUT": {
        await checkOut(actor, e.visiteId, at);
        return { statut: "ACCEPTE" };
      }
      case "KAYE_BROUILLON":
        return await saveDraft(actor, e, new Date(e.survenuA));
      case "KAYE_PUBLICATION": {
        try {
          // M8 : createKaye efface aussi le brouillon serveur, dans sa transaction.
          await createKaye(actor, {
            visitId: e.visiteId,
            mood: e.kaye.humeur,
            appetite: e.kaye.appetit,
            activities: [...new Set(e.kaye.activites)].slice(0, 10),
            note: e.kaye.note || null,
            alertFlag: e.kaye.aSurveiller,
            alertNote: e.kaye.aSurveiller ? (e.kaye.noteSurveillance ?? null) : null,
          });
        } catch (err) {
          if (!(err instanceof AccompagnantError) || (err.code !== "INVALIDE" && err.code !== "INTERDIT")) throw err;
          // M9 : refus récupérable (ex. check-in refusé juste avant) : le texte n'est pas perdu.
          // Il reste côté serveur en brouillon (relu par GET /visites/:id → brouillonKaye).
          const out = refused(err);
          if (await keepRefusedKayeAsDraft(actor, e)) {
            out.message = `${err.message} Votre Kayé est gardé en brouillon : vous pourrez l'envoyer ensuite.`.slice(0, 300);
          }
          return out;
        }
        return { statut: "ACCEPTE" };
      }
    }
  } catch (err) {
    if (err instanceof AccompagnantError) return refused(err);
    throw err;
  }
}

/**
 * M9 : garde le texte d'un Kayé refusé en brouillon serveur. Seulement si la visite est à cet accompagnant,
 * sans Kayé publié, mission active. Un brouillon plus récent n'est pas écrasé. Renvoie true si le texte est gardé.
 */
async function keepRefusedKayeAsDraft(actor: Actor, e: Extract<Evenement, { type: "KAYE_PUBLICATION" }>): Promise<boolean> {
  const parsed = brouillonKayeSchema.safeParse(e.kaye);
  if (!parsed.success) return false;
  try {
    const r = await saveDraft(actor, { ...e, type: "KAYE_BROUILLON", kaye: parsed.data }, new Date(e.survenuA));
    return r.statut === "ACCEPTE" && !r.message;
  } catch (err) {
    if (err instanceof AccompagnantError) return false;
    throw err;
  }
}

/**
 * Check-in (L10, § 2.3). Ordre : QR signé (ou code de secours), puis position ponctuelle.
 * - QR faux ou révoqué, code faux → le facteur est refusé. Sans autre facteur accepté : événement REFUSE.
 * - Échec de position (trop loin, imprécise, simulée, domicile approximatif) → ne bloque pas : « À vérifier ».
 * - Reçu plus de 30 min après l'heure de l'appareil (`late`) → « À vérifier » (P1/P8).
 * Le résultat porte `controle: { statut (VALIDE, A_VERIFIER, REFUSE), raison }` en français simple (contrat de l'app L1-C).
 */
async function checkIn(actor: Actor, e: Extract<Evenement, { type: "CHECK_IN" }>, at: Date, late: boolean): Promise<Outcome> {
  const preuves: NonNullable<Outcome["preuves"]> = {};
  let firstError: AccompagnantError | null = null;
  let codeOk = false;
  let positionOk = false;
  let recorded = false;
  const raisons: string[] = [];

  if (e.qr || e.codeDomicile) {
    try {
      const r = e.qr ? await checkInWithQr(actor, e.visiteId, e.qr, at) : await checkInWithCode(actor, e.visiteId, e.codeDomicile!, at);
      preuves.code = { valide: true, message: r.alreadyDone ? "Le code était déjà validé." : null };
      codeOk = true;
      recorded = true;
    } catch (err) {
      if (!(err instanceof AccompagnantError)) throw err;
      if (err.code === "INTROUVABLE") return { ...refused(err), controle: { statut: "REFUSE", raison: err.message } };
      preuves.code = { valide: false, message: err.message };
      firstError = err;
    }
  }
  if (e.position) {
    try {
      const ev = await checkInWithGps(
        actor,
        { visitId: e.visiteId, latitude: e.position.latitude, longitude: e.position.longitude, accuracy: e.position.precisionMetres, mocked: e.position.simulee === true },
        at,
      );
      preuves.position = { valide: ev.valid, message: ev.valid ? null : ev.reason ? GPS_FAILURE_MESSAGES[ev.reason] : null };
      positionOk = ev.valid;
      recorded = true;
      if (!ev.valid && ev.reason) raisons.push(GPS_FAILURE_MESSAGES[ev.reason]);
    } catch (err) {
      if (!(err instanceof AccompagnantError)) throw err;
      if (err.code === "INTROUVABLE") return { ...refused(err), controle: { statut: "REFUSE", raison: err.message } };
      preuves.position = { valide: false, message: err.message };
      firstError ??= err;
      raisons.push(err.message);
    }
  } else if (codeOk) {
    raisons.push("Position non envoyée.");
  }
  if (!recorded && firstError) return { ...refused(firstError), preuves, controle: { statut: "REFUSE", raison: firstError.message } };
  if (!codeOk) raisons.unshift(preuves.code?.message ?? "Carte du domicile non scannée.");
  if (late) raisons.push(`Check-in reçu plus de ${ECART_RECEPTION_CHECKIN_MAX_MIN} minutes après l'heure du téléphone.`);
  if (codeOk && positionOk && !late) {
    // L1d (D4) : en lancement, sans la confirmation de l'aîné, la visite est « Présence probable ».
    const raison = isLaunchMode()
      ? "Carte du domicile et position : présence probable. La famille employeur peut contester pendant 48 heures."
      : "Présence confirmée : carte du domicile et position.";
    return { statut: "ACCEPTE", preuves, controle: { statut: "VALIDE", raison } };
  }
  const raison = `${raisons.join(" ")} La famille employeur confirmera la visite.`.slice(0, 300);
  return { statut: "ACCEPTE", preuves, controle: { statut: "A_VERIFIER", raison } };
}

/** P1/P8 : un check-in reçu plus de 30 min après l'heure de l'appareil. */
export function isLateCheckIn(occurredAt: Date, receivedAt: Date): boolean {
  return receivedAt.getTime() - occurredAt.getTime() > ECART_RECEPTION_CHECKIN_MAX_MIN * 60_000;
}

/** P1/P8 : check-in en retard → la visite passe « À vérifier » (une seule fois), puis le statut est recalculé. */
async function flagLateCheckIn(actor: Actor, visitId: string, now: Date) {
  const r = await db.visit.updateMany({ where: { id: visitId, lateCheckInAt: null }, data: { lateCheckInAt: now } });
  if (r.count === 1) {
    await logAudit({ actor, action: "visit.late_checkin", entityType: "Visit", entityId: visitId, metadata: { thresholdMinutes: ECART_RECEPTION_CHECKIN_MAX_MIN } });
  }
  await refreshVisitStatus(visitId, now);
}

/** Brouillon de Kayé : le plus récent (heure de l'appareil) gagne. Pas de journal d'audit (pas une action sensible). */
async function saveDraft(actor: Actor, e: Extract<Evenement, { type: "KAYE_BROUILLON" }>, occurredAt: Date): Promise<Outcome> {
  const visit = await db.visit.findFirst({
    where: ownedVisitWhere(actor.id, e.visiteId),
    select: {
      id: true,
      journal: { select: { id: true } },
      kayeDraft: { select: { occurredAt: true } },
      mission: { select: { status: true } },
      aine: { select: { sandboxId: true, accordEtat: true, consentGiven: true, consentAt: true } },
    },
  });
  if (!visit) throw new AccompagnantError("Visite introuvable.", "INTROUVABLE");
  // L1d (D9) : pas de brouillon (texte de santé possible) en préinscription ni sans accord de l'aîné.
  assertAineDataOpen(visit.aine);
  if (visit.journal) throw new AccompagnantError("Le Kayé de cette visite est déjà publié.", "CONFLIT");
  if (visit.mission.status !== "ACTIVE") throw new AccompagnantError("Cette mission est suspendue ou terminée.", "INTERDIT");
  if (visit.kayeDraft && visit.kayeDraft.occurredAt.getTime() > occurredAt.getTime()) {
    return { statut: "ACCEPTE", message: "Un brouillon plus récent est déjà enregistré." };
  }
  const content = e.kaye as Prisma.InputJsonValue;
  await db.kayeDraft.upsert({
    where: { visitId: visit.id },
    create: { visitId: visit.id, authorId: actor.id, content, occurredAt },
    update: { authorId: actor.id, content, occurredAt },
  });
  return { statut: "ACCEPTE" };
}

/** X6 (sécurité D2) : alertes SOS au plus par compte et par heure. Au-delà : ACCEPTE (consigne 15/112), sans nouvelle alerte. */
export const MAX_SOS_PAR_HEURE = 3;

const CONSIGNE_SOS_DEMO =
  "Compte de démonstration : aucune alerte n'est envoyée à l'équipe. Si une personne est en danger, appelez le 15 (SAMU) ou le 112 maintenant.";

/**
 * SOS : journal + alerte des opérateurs du même monde (bac à sable ou réel). Aucune position, aucune donnée de santé.
 * X6 : compte démo partagé → SOS simulé (journal de démo, jamais d'alerte aux opérateurs réels).
 * X6 : au plus MAX_SOS_PAR_HEURE alertes par compte et par heure ; les suivantes sont journalisées (`sos.suppressed`).
 */
async function sos(actor: Actor, user: AppUser, visitId: string | null, at: Date, skew: boolean): Promise<Outcome> {
  const visit = visitId ? await db.visit.findFirst({ where: ownedVisitWhere(user.id, visitId), select: { id: true } }) : null;
  const related = visit ? { type: "Visit", id: visit.id } : { type: "User", id: user.id };
  const metadata = { source: "app", linkedVisit: visit !== null, clockSkew: skew };
  if (user.isDemo) {
    await logAudit({ actor, action: "sos.demo", entityType: related.type, entityId: related.id, metadata });
    return { statut: "ACCEPTE", consigne: CONSIGNE_SOS_DEMO };
  }
  const recent = await db.auditLog.count({
    where: { actorId: user.id, action: "sos.triggered", createdAt: { gt: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= MAX_SOS_PAR_HEURE) {
    await logAudit({ actor, action: "sos.suppressed", entityType: related.type, entityId: related.id, metadata });
    return { statut: "ACCEPTE", consigne: CONSIGNE_SOS };
  }
  await logAudit({ actor, action: "sos.triggered", entityType: related.type, entityId: related.id, metadata });
  const operators = await db.user.findMany({ where: { role: "OPERATEUR", sandboxId: user.sandboxId }, select: { id: true }, take: 20 });
  for (const op of operators) {
    await notifyUser(op.id, "SOS_ACCOMPAGNANT", { accompagnant: user.firstName, heure: formatTime(at) }, related);
  }
  return { statut: "ACCEPTE", consigne: CONSIGNE_SOS };
}

/** Écart d'horloge > 12 h : la visite passe « À vérifier » (une seule fois), puis le statut est recalculé. */
async function flagClockSkew(actor: Actor, visitId: string, now: Date) {
  const r = await db.visit.updateMany({ where: { id: visitId, clockSkewAt: null }, data: { clockSkewAt: now } });
  if (r.count === 1) {
    await logAudit({ actor, action: "visit.clock_skew", entityType: "Visit", entityId: visitId, metadata: { thresholdHours: 12 } });
  }
  await refreshVisitStatus(visitId, now);
}

// ─────────────── Propositions ───────────────

/**
 * Code m9 : « Accepter » idempotent. Si la proposition est déjà ACCEPTÉE par CET accompagnant (réponse perdue,
 * second appui), on renvoie la mission créée au lieu d'un CONFLIT. Null sinon.
 */
export async function acceptedProposal(userId: string, proposalId: string): Promise<{ missionId: string; visitCount: number } | null> {
  const p = await db.missionProposal.findFirst({
    where: { ...ownedProposalWhere(userId, proposalId), status: "ACCEPTEE" },
    select: { mission: { select: { id: true, _count: { select: { visits: true } } } } },
  });
  return p?.mission ? { missionId: p.mission.id, visitCount: p.mission._count.visits } : null;
}

export async function listAppProposals(userId: string, now: Date = new Date()): Promise<Proposition[]> {
  const { proposals } = await getPendingProposals(userId, now);
  return proposals.map((p) => ({
    id: p.id,
    message: p.message,
    creeLe: p.createdAt.toISOString(),
    fuseau: fuseauDe(p.request.aine.territoire),
    aine: {
      prenom: p.request.aine.firstName,
      territoire: p.request.aine.territoire,
      commune: p.request.aine.commune,
      communeLibelle: communeLabel(p.request.aine.commune),
    },
    demande: {
      niveau: p.request.level,
      frequence: p.request.frequency,
      dureeMinutes: p.request.durationMinutes,
      debut: p.request.startDate?.toISOString() ?? null,
      consignes: p.request.notes,
      creneaux: p.request.slots.map((s) => ({ jour: s.dayOfWeek, creneau: s.slot })),
    },
    visitesPrevues: p.plannedVisits,
  }));
}

/** Purge : événements reçus depuis plus de 30 jours (l'app a déjà vidé sa file). Appelée par la purge nocturne (X9). */
export async function purgeAppEvents(now: Date = new Date()): Promise<number> {
  const r = await db.appEvent.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - 30 * 24 * H) } } });
  return r.count;
}
