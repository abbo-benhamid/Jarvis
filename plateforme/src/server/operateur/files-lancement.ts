import "server-only";
import type { CaregiverStatus, CaregiverValidation } from "@prisma/client";
import { db } from "@/server/db";

/**
 * L1d (M10, D15 côté opérateur) : files du lancement, en tête du tableau de bord.
 * - Accords à recueillir : aînés réels « en attente de l'appel ».
 * - Rappels demandés : demandes d'appel des familles (formule ou question), non traitées.
 * - E-mails à confirmer : comptes réels famille / accompagnant sans e-mail confirmé.
 * - Accompagnants à appeler : statut serveur `caregiverCallReason` (F1, D15).
 */

const HOUR_MS = 60 * 60 * 1000;
/** Un profil sans orientation depuis plus de 48 h entre dans la file « à appeler » (UX B3). */
export const CAREGIVER_STALE_HOURS = 48;

/**
 * D15 (F1) : pourquoi appeler cet accompagnant.
 * - DEMANDE_ENVOYEE : vérification demandée (site ou app) → entretien, « casier vu le », validation.
 * - PROFIL_A_FINIR : orientation faite (site ou app), il reste des éléments du site (communes, disponibilités,
 *   tarif, pièces) → aider la personne à finir, ou à demander la vérification.
 * - SANS_SUITE : inscrit depuis plus de 48 h sans orientation → appeler pour expliquer la suite.
 */
export type CaregiverCallReason = "DEMANDE_ENVOYEE" | "PROFIL_A_FINIR" | "SANS_SUITE";

export const CALL_REASON_LABELS: Record<CaregiverCallReason, string> = {
  DEMANDE_ENVOYEE: "Vérification demandée : faites l'entretien.",
  PROFIL_A_FINIR: "Orientation faite, profil à finir : aidez la personne.",
  SANS_SUITE: `Inscrit depuis plus de ${CAREGIVER_STALE_HOURS} h, sans orientation : appelez pour expliquer la suite.`,
};

/** Pur : raison de l'appel, ou null si personne n'a besoin d'appel. */
export function caregiverCallReason(
  p: { validation: CaregiverValidation; status: CaregiverStatus | null; createdAt: Date },
  now: Date = new Date(),
): CaregiverCallReason | null {
  if (p.validation === "EN_ATTENTE") return "DEMANDE_ENVOYEE";
  if (p.validation !== "BROUILLON") return null;
  if (p.status) return "PROFIL_A_FINIR";
  return now.getTime() - p.createdAt.getTime() > CAREGIVER_STALE_HOURS * HOUR_MS ? "SANS_SUITE" : null;
}

/** Même règle que `caregiverCallReason`, en filtre Prisma. */
function caregiverToCallWhere(now: Date) {
  const staleBefore = new Date(now.getTime() - CAREGIVER_STALE_HOURS * HOUR_MS);
  return {
    user: { sandboxId: null, isDemo: false },
    OR: [
      { validation: "EN_ATTENTE" as const },
      { validation: "BROUILLON" as const, status: { not: null } },
      { validation: "BROUILLON" as const, status: null, createdAt: { lt: staleBefore } },
    ],
  };
}

export async function launchQueueCounts(now: Date = new Date()) {
  const [accords, rappels, emails, accompagnants] = await Promise.all([
    db.aine.count({ where: { sandboxId: null, accordEtat: "EN_ATTENTE_ACCORD" } }),
    db.planActivationRequest.count({ where: { status: "NOUVELLE" } }),
    db.user.count({ where: { emailVerifiedAt: null, isDemo: false, sandboxId: null, role: { in: ["FAMILLE", "ACCOMPAGNANT"] } } }),
    db.caregiverProfile.count({ where: caregiverToCallWhere(now) }),
  ]);
  return { accords, rappels, emails, accompagnants };
}

const REASON_ORDER: Record<CaregiverCallReason, number> = { DEMANDE_ENVOYEE: 0, PROFIL_A_FINIR: 1, SANS_SUITE: 2 };

/** File « Accompagnants à appeler » (D15) : demandes envoyées d'abord, puis les plus anciens. */
export async function listCaregiversToCall(now: Date = new Date()) {
  const rows = await db.caregiverProfile.findMany({
    where: caregiverToCallWhere(now),
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      validation: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { firstName: true, lastName: true, phone: true, email: true, emailVerifiedAt: true } },
      verifications: { select: { status: true } },
    },
  });
  return rows
    .map((r) => ({ ...r, raison: caregiverCallReason(r, now) ?? ("SANS_SUITE" as const) }))
    .sort((a, b) => REASON_ORDER[a.raison] - REASON_ORDER[b.raison]);
}
