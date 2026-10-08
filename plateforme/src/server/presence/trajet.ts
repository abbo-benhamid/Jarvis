import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { sameScope } from "@/server/scope";
import { haversineMeters } from "@/server/visits/proof";
import { PRESENCE_REFUSAL_MESSAGES, presenceRefusal } from "@/server/visits/launch-guards";
import { homePoint, type HomePointSource } from "./address";
import type { DemandePosition, ReponseTrajet, ReponseTrajetFamille } from "@/contracts/v1/trajet";
import {
  TRAJET_DUREE_MS,
  TRAJET_INTERVALLE_MIN_MS,
  arrivedHome,
  canStartTrip,
  departureMasked,
  estimateMinutes,
  positionTime,
  roundCoord,
  roundedAccuracy,
  tripViewerIds,
} from "./trajet-rules";

/**
 * L1-B (L6, R3, R4) : trajet en direct. UNE ligne `VisitTrip` par visite, sans historique.
 * - Démarré par l'accompagnant lui-même ; arrêté au check-in, à « ARRETER », à moins de 150 m du domicile, ou à 60 min.
 * - Vu par l'employeur (payeur) et la personne désignée par l'aîné. Pas par tout le cercle. Pas par l'opérateur,
 *   sauf pendant un SOS actif (chaque accès journalisé).
 * - Journal : jamais de coordonnées.
 */

export type TripActor = { id: string; role: Role; firstName?: string; sandboxId: string | null };

export type TripErrorCode = "INTROUVABLE" | "CONFLIT" | "INTERDIT" | "TROP_DE_REQUETES";

export class TripError extends Error {
  constructor(
    message: string,
    readonly code: TripErrorCode,
  ) {
    super(message);
    this.name = "TripError";
  }
}

const VISIT_NOT_FOUND = "Visite introuvable.";

export type TripEndReason = "CHECK_IN" | "ARRETER" | "ARRIVEE" | "EXPIRATION" | "PURGE";

/** Arrête le trajet d'une visite (efface la ligne et la dernière position). Journalisé s'il existait. */
export async function endTripForVisit(visitId: string, reason: TripEndReason, actor?: { id: string; role: Role }): Promise<boolean> {
  const r = await db.visitTrip.deleteMany({ where: { visitId } });
  if (r.count > 0) {
    await logAudit({ actor: actor ?? null, action: "trip.stopped", entityType: "Visit", entityId: visitId, metadata: { reason } });
  }
  return r.count > 0;
}

/**
 * L1d (D7, code M3, sécu M6) : effacement PARESSEUX. Chaque lecture ou écriture de trajet efface d'abord TOUS les
 * trajets expirés (60 min), et avec eux la dernière position et le point de départ. Requête indexée (`expiresAt`).
 * La purge de nuit reste le filet de sécurité quand aucun appel n'arrive.
 */
export async function purgeExpiredTrips(now: Date = new Date()): Promise<number> {
  const r = await db.visitTrip.deleteMany({ where: { expiresAt: { lte: now } } });
  return r.count;
}

async function loadOwnedVisitForTrip(userId: string, visitId: string) {
  const visit = await db.visit.findFirst({
    where: { id: visitId, caregiver: { userId } },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      checkInAt: true,
      checkOutAt: true,
      caregiver: { select: { validation: true } },
      mission: { select: { status: true } },
      aine: { select: { accordEtat: true, consentGiven: true, consentAt: true, sandboxId: true, latitude: true, longitude: true, locationApproximate: true, homeGeoEnc: true } },
      trip: true,
    },
  });
  if (!visit) throw new TripError(VISIT_NOT_FOUND, "INTROUVABLE");
  return visit;
}

/** D3 : domicile pour une réponse (arrondi à 3 décimales, environ 110 m). */
function roundedHome(aine: HomePointSource) {
  const p = homePoint(aine);
  return { latitude: roundCoord(p.lat), longitude: roundCoord(p.lng), approximatif: p.approximate };
}

/** POST /visites/:id/trajet — DEMARRER (idempotent tant que le trajet court) ou ARRETER (idempotent). */
export async function startOrStopTrip(actor: TripActor, visitId: string, action: "DEMARRER" | "ARRETER", now: Date = new Date()): Promise<ReponseTrajet> {
  await purgeExpiredTrips(now);
  const visit = await loadOwnedVisitForTrip(actor.id, visitId);
  if (action === "ARRETER") {
    await endTripForVisit(visit.id, "ARRETER", actor);
    return { trajet: { etat: "ARRETE", expireA: null } };
  }
  if (visit.caregiver.validation !== "VALIDE") throw new TripError("Votre profil n'est pas actif.", "INTERDIT");
  if (visit.mission.status !== "ACTIVE") throw new TripError("Cette mission est suspendue ou terminée.", "INTERDIT");
  const refusal = presenceRefusal(visit.aine);
  if (refusal) throw new TripError(PRESENCE_REFUSAL_MESSAGES[refusal], "INTERDIT");
  const state = canStartTrip(visit, now);
  if (state === "DEJA_ARRIVE") throw new TripError("Le check-in est déjà fait : le trajet n'a plus lieu d'être partagé.", "CONFLIT");
  if (state === "TROP_TOT") throw new TripError("Le partage du trajet s'ouvre 2 heures avant le début de la visite.", "INTERDIT");
  if (state === "TROP_TARD") throw new TripError("Cette visite est terminée : le trajet ne peut plus être partagé.", "INTERDIT");
  // Carte d'itinéraire de l'app (L1-C) : domicile arrondi ; l'accord de l'aîné est déjà vérifié (presenceRefusal).
  const domicile = roundedHome(visit.aine);

  if (visit.trip && visit.trip.expiresAt.getTime() > now.getTime()) {
    return { trajet: { etat: "EN_COURS", expireA: visit.trip.expiresAt.toISOString() }, domicile };
  }
  const expiresAt = new Date(now.getTime() + TRAJET_DUREE_MS);
  // Un trajet expiré est remplacé (sa dernière position est effacée).
  const trip = await db.visitTrip.upsert({
    where: { visitId: visit.id },
    create: { visitId: visit.id, userId: actor.id, startedAt: now, expiresAt },
    update: {
      userId: actor.id,
      startedAt: now,
      expiresAt,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      positionAt: null,
      receivedAt: null,
      startLatitude: null,
      startLongitude: null,
    },
  });
  await logAudit({ actor, action: "trip.started", entityType: "Visit", entityId: visit.id, metadata: { durationMinutes: TRAJET_DUREE_MS / 60_000 } });
  return { trajet: { etat: "EN_COURS", expireA: trip.expiresAt.toISOString() }, domicile };
}

/**
 * POST /visites/:id/position. Aucune position sans trajet en cours (CONFLIT).
 * Au plus une position toutes les 30 s (TROP_DE_REQUETES), décision atomique en base.
 * Position simulée ou périmée : reçue, jamais gardée. Coordonnées arrondies à 3 décimales.
 * À moins de 150 m du domicile : le trajet s'arrête (ARRIVEE).
 */
export async function recordTripPosition(actor: TripActor, visitId: string, input: DemandePosition, receivedAt: Date = new Date()): Promise<"GARDEE" | "IGNOREE" | "ARRIVEE"> {
  await purgeExpiredTrips(receivedAt);
  const visit = await loadOwnedVisitForTrip(actor.id, visitId);
  const trip = visit.trip;
  if (!trip || trip.expiresAt.getTime() <= receivedAt.getTime() || visit.checkInAt) {
    if (trip) await endTripForVisit(visit.id, visit.checkInAt ? "CHECK_IN" : "EXPIRATION");
    throw new TripError("Aucun trajet en cours pour cette visite.", "CONFLIT");
  }
  // Code m3 : mêmes contrôles qu'au démarrage. Profil suspendu, mission suspendue ou accord retiré pendant le
  // trajet → le trajet s'arrête et la position n'est pas écrite.
  const refusal = presenceRefusal(visit.aine);
  if (visit.caregiver.validation !== "VALIDE" || visit.mission.status !== "ACTIVE" || refusal) {
    await endTripForVisit(visit.id, "ARRETER", actor);
    throw new TripError(refusal ? PRESENCE_REFUSAL_MESSAGES[refusal] : "Ce trajet ne peut plus être partagé.", "INTERDIT");
  }
  const lat = roundCoord(input.latitude);
  const lng = roundCoord(input.longitude);
  const at = input.simulee ? null : positionTime(new Date(input.survenuA), receivedAt);
  const minPrev = new Date(receivedAt.getTime() - TRAJET_INTERVALLE_MIN_MS);
  const claim = await db.visitTrip.updateMany({
    where: { id: trip.id, expiresAt: { gt: receivedAt }, OR: [{ receivedAt: null }, { receivedAt: { lte: minPrev } }] },
    data: {
      receivedAt,
      ...(at
        ? {
            latitude: lat,
            longitude: lng,
            accuracyMeters: roundedAccuracy(input.precisionMetres),
            positionAt: at,
            ...(trip.startLatitude === null ? { startLatitude: lat, startLongitude: lng } : {}),
          }
        : {}),
    },
  });
  if (claim.count !== 1) {
    // Code m3 : la ligne a pu être effacée entre-temps (check-in, ARRETER, expiration) → 409, pas 429.
    const still = await db.visitTrip.findUnique({ where: { id: trip.id }, select: { expiresAt: true } });
    if (!still || still.expiresAt.getTime() <= receivedAt.getTime()) throw new TripError("Aucun trajet en cours pour cette visite.", "CONFLIT");
    throw new TripError("Une position toutes les 30 secondes au plus.", "TROP_DE_REQUETES");
  }
  if (!at) return "IGNOREE";
  if (arrivedHome({ lat, lng }, homePoint(visit.aine))) {
    await endTripForVisit(visit.id, "ARRIVEE", actor);
    return "ARRIVEE";
  }
  return "GARDEE";
}

// ─────────────── Vue famille ───────────────

/** GET /api/famille/visites/:id/trajet : employeur ou personne désignée seulement (R4). Null = introuvable ou non permis. */
export async function getFamilyTripView(user: TripActor, visitId: string, now: Date = new Date()): Promise<ReponseTrajetFamille | null> {
  if (user.role !== "FAMILLE") return null;
  await purgeExpiredTrips(now);
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      checkInAt: true,
      checkOutAt: true,
      caregiver: { select: { user: { select: { firstName: true } } } },
      aine: {
        select: {
          sandboxId: true,
          latitude: true,
          longitude: true,
          locationApproximate: true,
          homeGeoEnc: true,
          tripViewerId: true,
          accordEtat: true,
          consentGiven: true,
          consentAt: true,
          members: { select: { userId: true, isPayer: true } },
        },
      },
      trip: true,
    },
  });
  if (!visit || !sameScope(visit.aine.sandboxId, user.sandboxId)) return null;
  if (!tripViewerIds(visit.aine).has(user.id)) return null;

  const home = homePoint(visit.aine);
  const base = {
    heurePrevue: visit.scheduledStart.toISOString(),
    accompagnant: { prenom: visit.caregiver.user.firstName },
    domicile: { latitude: home.lat, longitude: home.lng, approximatif: home.approximate },
  };
  if (visit.checkOutAt || visit.status === "VALIDEE" || (visit.status === "A_VERIFIER" && !visit.checkInAt)) return { etat: "TERMINEE", ...base };
  if (visit.checkInAt) return { etat: "COMMENCEE", ...base };

  const trip = visit.trip;
  if (trip && trip.expiresAt.getTime() <= now.getTime()) {
    await endTripForVisit(visit.id, "EXPIRATION");
    return { etat: "PREVUE", ...base };
  }
  // R4 : hors trajet, ou départ masqué → seulement l'heure prévue (jamais « non partagé »).
  if (!trip || trip.latitude === null || trip.longitude === null || !trip.positionAt || presenceRefusal(visit.aine)) {
    return { etat: "PREVUE", ...base };
  }
  const current = { lat: trip.latitude, lng: trip.longitude };
  const start = trip.startLatitude !== null && trip.startLongitude !== null ? { lat: trip.startLatitude, lng: trip.startLongitude } : null;
  if (departureMasked(start, current)) return { etat: "PREVUE", ...base };
  const distance = Math.round(haversineMeters(current, home) / 10) * 10;
  return {
    etat: "EN_ROUTE",
    ...base,
    position: { latitude: trip.latitude, longitude: trip.longitude, precisionMetres: trip.accuracyMeters ?? 110, majA: trip.positionAt.toISOString() },
    distanceMetres: distance,
    minutesEstimees: estimateMinutes(distance),
  };
}

// ─────────────── Opérateur (R3) ───────────────

/** R3 : l'opérateur voit seulement « trajet partagé : oui/non ». Renvoie les visites avec un trajet en cours. */
export async function visitsWithActiveTrip(visitIds: string[], now: Date = new Date()): Promise<Set<string>> {
  if (visitIds.length === 0) return new Set();
  await purgeExpiredTrips(now);
  const rows = await db.visitTrip.findMany({ where: { visitId: { in: visitIds }, expiresAt: { gt: now } }, select: { visitId: true } });
  return new Set(rows.map((r) => r.visitId));
}

/** Un SOS est actif s'il a été lancé dans les 60 dernières minutes, pour cette visite ou par cet accompagnant. */
export const SOS_ACTIF_MS = 60 * 60_000;

/**
 * R3 (exception) : pendant un SOS actif, l'opérateur voit la dernière position du trajet. Chaque accès est
 * journalisé (`trip.position.viewed_sos`, sans coordonnées). Null hors SOS ou sans position.
 */
export async function getOperatorSosPosition(operator: TripActor, visitId: string, now: Date = new Date()) {
  if (operator.role !== "OPERATEUR") return null;
  await purgeExpiredTrips(now);
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { id: true, aine: { select: { sandboxId: true, firstName: true, latitude: true, longitude: true, locationApproximate: true, homeGeoEnc: true } }, caregiver: { select: { userId: true, user: { select: { firstName: true } } } }, trip: true },
  });
  if (!visit || !sameScope(visit.aine.sandboxId, operator.sandboxId)) return null;
  const since = new Date(now.getTime() - SOS_ACTIF_MS);
  const sos = await db.auditLog.findFirst({
    where: {
      action: "sos.triggered",
      createdAt: { gt: since },
      OR: [{ entityType: "Visit", entityId: visit.id }, { actorId: visit.caregiver.userId }],
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!sos) return { sosActif: false as const };
  const trip = visit.trip && visit.trip.expiresAt.getTime() > now.getTime() ? visit.trip : null;
  await logAudit({ actor: operator, action: "trip.position.viewed_sos", entityType: "Visit", entityId: visit.id, metadata: { hasPosition: Boolean(trip?.latitude != null) } });
  return {
    sosActif: true as const,
    sosA: sos.createdAt,
    aine: visit.aine.firstName,
    accompagnant: visit.caregiver.user.firstName,
    domicile: (() => {
      const h = homePoint(visit.aine);
      return { latitude: h.lat, longitude: h.lng, approximatif: h.approximate };
    })(),
    position:
      trip && trip.latitude !== null && trip.longitude !== null && trip.positionAt
        ? { latitude: trip.latitude, longitude: trip.longitude, precisionMetres: trip.accuracyMeters ?? 110, majA: trip.positionAt }
        : null,
  };
}

// ─────────────── Purge ───────────────

/** Purge nocturne : trajets expirés, ou dont la visite a déjà son check-in. Renvoie le nombre effacé. */
export async function purgeTrips(now: Date = new Date()): Promise<number> {
  const r = await db.visitTrip.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { visit: { checkInAt: { not: null } } }] } });
  return r.count;
}
