import "server-only";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { NOTICE_FALC_VERSION } from "@/lib/legal-launch";
import { generateUniqueHomeCode } from "@/server/visits/service";
import { lockCareRequests } from "@/server/matching/locks";
import { zonedToUtc } from "@/lib/fuseau";
import { fuseauDe } from "@/lib/territoires";
import { TERRITOIRE_EQUIPE } from "@/lib/rappel";

/**
 * R5 (J5) : un conseiller Koudmen appelle l'aîné, lit la notice FALC et enregistre sa réponse.
 * - Accord : date et heure de l'appel, qui répond (aîné ou représentant), langue, notice lue (obligatoire).
 * - Mesure de protection (tutelle, curatelle…) : « jugement vu le … » obligatoire, aucune copie gardée.
 * - L1d (D14) : trois réponses : ACCORD, REFUS, RAPPELER (« rappeler plus tard » : l'état reste en attente).
 *   Le retrait (RETRAIT) arrête un accord déjà recueilli.
 * - L1d (D11) : pendant l'appel d'accord, L'AÎNÉ choisit la « personne désignée » qui voit le trajet en direct
 *   (en plus de l'employeur). Le conseiller l'enregistre (date de l'appel, conseiller). Défaut : l'employeur seul.
 * - L1d (D8) : refus ou retrait → missions suspendues, visites à venir annulées, demandes closes, carte QR révoquée,
 *   code de secours changé, trajets arrêtés, brouillons de Kayé effacés (et Kayé bloqués par les gardes R5).
 * Journal : qui (conseiller), quand, résultat, langue, situation. Jamais de nom en clair.
 */

export const SITUATIONS = ["AUCUNE", "TUTELLE", "CURATELLE", "HABILITATION_FAMILIALE", "MANDAT_PROTECTION_FUTURE"] as const;

export const SITUATION_LABELS: Record<(typeof SITUATIONS)[number], string> = {
  AUCUNE: "Aucune mesure",
  TUTELLE: "Tutelle",
  CURATELLE: "Curatelle",
  HABILITATION_FAMILIALE: "Habilitation familiale",
  MANDAT_PROTECTION_FUTURE: "Mandat de protection future",
};

/** D11 : valeur du champ « personne désignée » quand l'aîné garde le défaut (l'employeur seul). */
export const EMPLOYEUR = "EMPLOYEUR";

/** D14 : réponses de l'appel d'accord (aucune n'est cochée par défaut dans le formulaire). */
export const ACCORD_RESULTATS = ["ACCORD", "REFUS", "RAPPELER", "RETRAIT"] as const;

const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const optionalDate = z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").optional());
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess((v) => (v === "" ? undefined : v), z.enum(values).optional());

export const accordSchema = z
  .object({
    aineId: z.string().cuid(),
    resultat: z.enum(ACCORD_RESULTATS, { message: "Choisissez la réponse de l'aîné." }),
    appelLe: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indiquez la date et l'heure de l'appel."),
    qui: optionalEnum(["AINE", "REPRESENTANT"] as const),
    nomRepresentant: optionalText(120),
    langue: optionalEnum(["FR", "GCF"] as const),
    noticeLue: z.preprocess((v) => v === "on", z.boolean()),
    situationJuridique: optionalEnum(SITUATIONS),
    justificatifVuLe: optionalDate,
    /**
     * D11 : personne désignée CHOISIE PAR L'AÎNÉ pendant l'appel (identifiant d'un membre du cercle Lakou).
     * Vide = l'employeur seul (défaut). Seulement avec la réponse ACCORD.
     */
    personneDesignee: z.preprocess((v) => (v === "" || v === EMPLOYEUR ? undefined : v), z.string().cuid("Choisissez une personne du cercle.").optional()),
  })
  .superRefine((v, ctx) => {
    if (v.resultat === "RAPPELER") return;
    if (!v.qui) ctx.addIssue({ code: "custom", path: ["qui"], message: "Indiquez qui a répondu." });
    if (!v.langue) ctx.addIssue({ code: "custom", path: ["langue"], message: "Indiquez la langue de l'appel." });
    if (!v.situationJuridique) ctx.addIssue({ code: "custom", path: ["situationJuridique"], message: "Indiquez la situation juridique." });
    if (v.resultat === "ACCORD" && !v.noticeLue) ctx.addIssue({ code: "custom", path: ["noticeLue"], message: "Lisez la notice à l'aîné avant d'enregistrer son accord." });
    if (v.qui === "REPRESENTANT" && !v.nomRepresentant) ctx.addIssue({ code: "custom", path: ["nomRepresentant"], message: "Indiquez le nom et le rôle du représentant." });
    if (v.situationJuridique && v.situationJuridique !== "AUCUNE" && !v.justificatifVuLe) {
      ctx.addIssue({ code: "custom", path: ["justificatifVuLe"], message: "Indiquez la date où vous avez vu le jugement ou le mandat." });
    }
    if (v.personneDesignee && v.resultat !== "ACCORD") {
      ctx.addIssue({ code: "custom", path: ["personneDesignee"], message: "La personne désignée s'enregistre avec l'accord de l'aîné." });
    }
  });

export type AccordInput = z.infer<typeof accordSchema>;

const TARGET = { ACCORD: "ACCORD_RECUEILLI", REFUS: "ACCORD_REFUSE", RETRAIT: "ACCORD_RETIRE" } as const;

type Result = { ok: true } | { ok: false; error: string };

/**
 * Heure saisie dans le fuseau de l'équipe Koudmen (T4 : fuseau IANA du territoire de l'équipe, Guadeloupe au lancement).
 * Format « AAAA-MM-JJTHH:MM ». Null si invalide ou dans le futur.
 */
export function callDate(appelLe: string, now: Date, tz: string = fuseauDe(TERRITOIRE_EQUIPE)): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(appelLe);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const appel = zonedToUtc(y, mo, d, h, mi, tz);
  if (Number.isNaN(appel.getTime()) || appel > new Date(now.getTime() + 5 * 60_000)) return null;
  return appel;
}

/**
 * D11 : la personne désignée doit être membre du cercle Lakou de l'aîné. L'employeur (payeur) voit déjà le
 * trajet : le choisir revient au défaut (null). Renvoie l'id à enregistrer, ou une erreur.
 */
async function resolveViewer(aineId: string, viewerId: string | undefined): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!viewerId) return { ok: true, id: null };
  const member = await db.lakouMember.findFirst({ where: { aineId, userId: viewerId }, select: { isPayer: true } });
  if (!member) return { ok: false, error: "Cette personne n'est pas dans le cercle Lakou de l'aîné." };
  return { ok: true, id: member.isPayer ? null : viewerId };
}

/** Enregistre la réponse de l'aîné. Le retrait n'est possible qu'après un accord. */
export async function recordElderAccord(operator: { id: string; role: Role }, v: AccordInput, now: Date = new Date()): Promise<Result> {
  const aine = await db.aine.findUnique({ where: { id: v.aineId }, select: { id: true, firstName: true, accordEtat: true, sandboxId: true } });
  if (!aine || aine.sandboxId) return { ok: false, error: "Aîné introuvable." };
  if (v.resultat === "RETRAIT" && aine.accordEtat !== "ACCORD_RECUEILLI") return { ok: false, error: "Le retrait s'applique seulement à un accord déjà recueilli." };
  if (v.resultat !== "RETRAIT" && aine.accordEtat === "ACCORD_RECUEILLI") return { ok: false, error: "L'accord est déjà recueilli. Pour l'arrêter, choisissez « Retrait »." };
  if (v.resultat !== "RETRAIT" && (aine.accordEtat === "ACCORD_REFUSE" || aine.accordEtat === "ACCORD_RETIRE")) {
    return { ok: false, error: "L'aîné a refusé ou retiré son accord : sa fiche est fermée." };
  }
  const appel = callDate(v.appelLe, now);
  if (!appel) return { ok: false, error: "La date de l'appel est dans le futur." };

  // D14 : « rappeler plus tard ». L'état reste EN_ATTENTE_ACCORD ; seule la date de l'appel est gardée.
  if (v.resultat === "RAPPELER") {
    await db.aine.update({ where: { id: aine.id }, data: { accordRappelAt: appel } });
    await logAudit({ actor: operator, action: "aine.accord_rappel", entityType: "Aine", entityId: aine.id, metadata: { resultat: "RAPPELER" } });
    return { ok: true };
  }

  const viewer = await resolveViewer(aine.id, v.personneDesignee);
  if (!viewer.ok) return viewer;
  const target = TARGET[v.resultat];
  // D8 : nouveau code de secours avant la transaction (unicité vérifiée en base).
  const newHomeCode = target === "ACCORD_RECUEILLI" ? null : await generateUniqueHomeCode();
  await db.$transaction(async (tx) => {
    await tx.aine.update({
      where: { id: aine.id },
      data: {
        accordEtat: target,
        accordAt: appel,
        accordRecordedById: operator.id,
        accordLangue: v.langue!,
        accordNoticeVersion: v.noticeLue ? NOTICE_FALC_VERSION : null,
        situationJuridique: v.situationJuridique!,
        justificatifVuLe: v.justificatifVuLe ? new Date(`${v.justificatifVuLe}T00:00:00Z`) : null,
        consentGiven: target === "ACCORD_RECUEILLI",
        consentByType: v.qui!,
        consentByName: v.qui === "AINE" ? aine.firstName : v.nomRepresentant!,
        consentAt: appel,
        // D11 : choix de l'aîné pendant l'appel (vide = l'employeur seul).
        ...(target === "ACCORD_RECUEILLI"
          ? { tripViewerId: viewer.id, tripViewerChosenAt: viewer.id ? appel : null, tripViewerRecordedById: viewer.id ? operator.id : null }
          : {}),
      },
    });
    const frozen = target === "ACCORD_RECUEILLI" ? null : await freezeAine(tx, aine.id, newHomeCode!, now);
    await logAudit(
      {
        actor: operator,
        action: "aine.accord_recorded",
        entityType: "Aine",
        entityId: aine.id,
        metadata: {
          resultat: v.resultat,
          qui: v.qui ?? null,
          langue: v.langue ?? null,
          situation: v.situationJuridique ?? null,
          notice: v.noticeLue ? NOTICE_FALC_VERSION : null,
          personneDesignee: Boolean(viewer.id),
          ...(frozen ?? {}),
        },
      },
      tx,
    );
  });
  return { ok: true };
}

export type FreezeResult = { suspendedMissions: number; cancelledVisits: number; closedRequests: number; cancelledProposals: number; stoppedTrips: number; deletedDrafts: number };

/**
 * D8 (code M2, sécu M7) : l'aîné refuse ou retire son accord. DANS la transaction de l'enregistrement :
 * - propositions actives annulées, demandes OUVERTE / PROPOSEE closes (ANNULEE) ;
 * - missions ACTIVE → SUSPENDUE ; visites à venir sans check-in annulées (effacées) ;
 * - carte domicile révoquée (identifiant de carte effacé, version + 1) et nouveau code de secours ;
 * - trajets en cours arrêtés (position effacée), brouillons de Kayé effacés ;
 * - personne désignée effacée.
 * Les Kayé et check-in suivants sont refusés par les gardes R5 (accord manquant).
 */
export async function freezeAine(tx: Prisma.TransactionClient, aineId: string, newHomeCode: string, now: Date = new Date()): Promise<FreezeResult> {
  const requests = await tx.careRequest.findMany({ where: { aineId, status: { in: ["OUVERTE", "PROPOSEE", "POURVUE"] } }, select: { id: true } });
  await lockCareRequests(tx, requests.map((r) => r.id));
  const proposals = await tx.missionProposal.updateMany({
    where: { request: { aineId }, status: { in: ["EN_ATTENTE", "PROPOSEE_FAMILLE"] } },
    data: { status: "ANNULEE", respondedAt: now },
  });
  const closed = await tx.careRequest.updateMany({ where: { aineId, status: { in: ["OUVERTE", "PROPOSEE"] } }, data: { status: "ANNULEE" } });
  const missions = await tx.mission.updateMany({ where: { aineId, status: "ACTIVE" }, data: { status: "SUSPENDUE" } });
  const trips = await tx.visitTrip.deleteMany({ where: { visit: { aineId } } });
  const drafts = await tx.kayeDraft.deleteMany({ where: { visit: { aineId, journal: null } } });
  const visits = await tx.visit.deleteMany({ where: { aineId, status: "PREVUE", checkInAt: null, scheduledEnd: { gt: now } } });
  await tx.aine.update({
    where: { id: aineId },
    data: { homeCardId: null, homeCardVersion: { increment: 1 }, homeCardIssuedAt: now, homeCode: newHomeCode, tripViewerId: null, tripViewerChosenAt: null, tripViewerRecordedById: null },
  });
  return {
    suspendedMissions: missions.count,
    cancelledVisits: visits.count,
    closedRequests: closed.count,
    cancelledProposals: proposals.count,
    stoppedTrips: trips.count,
    deletedDrafts: drafts.count,
  };
}

export const tripViewerChoiceSchema = z.object({
  aineId: z.string().cuid(),
  appelLe: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indiquez la date et l'heure de l'appel."),
  /** Vide = l'employeur seul. */
  personneDesignee: z.preprocess((v) => (v === "" || v === EMPLOYEUR ? undefined : v), z.string().cuid().optional()),
  confirm: z.literal("on", { message: "Confirmez que l'aîné a fait ce choix au téléphone." }),
});

/**
 * D11 : l'aîné change sa personne désignée lors d'un nouvel appel. Le conseiller l'enregistre (accord recueilli).
 * Journal : conseiller, aîné, « désignée oui/non ». Jamais de nom.
 */
export async function recordTripViewerChoice(operator: { id: string; role: Role }, v: z.infer<typeof tripViewerChoiceSchema>, now: Date = new Date()): Promise<Result> {
  const aine = await db.aine.findUnique({ where: { id: v.aineId }, select: { id: true, accordEtat: true, sandboxId: true } });
  if (!aine || aine.sandboxId) return { ok: false, error: "Aîné introuvable." };
  if (aine.accordEtat !== "ACCORD_RECUEILLI") return { ok: false, error: "Enregistrez d'abord l'accord de l'aîné." };
  const appel = callDate(v.appelLe, now);
  if (!appel) return { ok: false, error: "La date de l'appel est dans le futur." };
  const viewer = await resolveViewer(aine.id, v.personneDesignee);
  if (!viewer.ok) return viewer;
  await db.aine.update({
    where: { id: aine.id },
    data: { tripViewerId: viewer.id, tripViewerChosenAt: appel, tripViewerRecordedById: operator.id },
  });
  await logAudit({ actor: operator, action: "aine.trip_viewer.recorded", entityType: "Aine", entityId: aine.id, metadata: { designated: Boolean(viewer.id) } });
  return { ok: true };
}

/**
 * Aînés à appeler (accord en attente) et derniers accords. Monde réel seulement.
 * D11 : les membres du cercle Lakou (choix de la personne désignée) et la personne désignée actuelle.
 */
export async function listAinesForAccord() {
  const rows = await db.aine.findMany({
    where: { sandboxId: null, accordEtat: { in: ["EN_ATTENTE_ACCORD", "ACCORD_RECUEILLI", "ACCORD_REFUSE", "ACCORD_RETIRE"] } },
    orderBy: [{ accordEtat: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      firstName: true,
      commune: true,
      phone: true,
      accordEtat: true,
      accordAt: true,
      accordRappelAt: true,
      createdAt: true,
      tripViewerId: true,
      tripViewerChosenAt: true,
      owner: { select: { firstName: true, lastName: true, phone: true } },
      members: { select: { userId: true, isPayer: true, relation: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { joinedAt: "asc" } },
    },
  });
  // Interface F2 : `lastRappel` = dernier appel « rappeler plus tard » (seulement tant que l'accord est en attente).
  return rows.map((r) => ({ ...r, lastRappel: r.accordEtat === "EN_ATTENTE_ACCORD" ? r.accordRappelAt : null }));
}

/** Comptes réels dont l'e-mail n'est pas confirmé (L3, page « Comptes »). */
export async function listUnverifiedAccounts() {
  return db.user.findMany({
    where: { emailVerifiedAt: null, isDemo: false, sandboxId: null, role: { in: ["FAMILLE", "ACCOMPAGNANT"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
  });
}
