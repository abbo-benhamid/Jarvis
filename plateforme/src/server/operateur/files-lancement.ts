import "server-only";
import { db } from "@/server/db";

/**
 * L1d (M10, D15 côté opérateur) : files du lancement, en tête du tableau de bord.
 * - Accords à recueillir : aînés réels « en attente de l'appel ».
 * - Rappels demandés : demandes d'appel des familles (formule ou question), non traitées.
 * - E-mails à confirmer : comptes réels famille / accompagnant sans e-mail confirmé.
 * - Accompagnants à appeler : voir `listCaregiversToCall`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Un profil « incomplet » depuis plus de 48 h entre dans la file « à appeler » (UX B3). */
export const CAREGIVER_STALE_HOURS = 48;

function caregiverToCallWhere(now: Date) {
  const staleBefore = new Date(now.getTime() - (CAREGIVER_STALE_HOURS / 24) * DAY_MS);
  // L1d: à brancher sur F1 — F1 ajoute le statut serveur de la demande de vérification faite dans l'app (D15).
  // En attendant : vérification demandée (EN_ATTENTE), ou profil resté « brouillon » plus de 48 h.
  return {
    user: { sandboxId: null, isDemo: false },
    OR: [{ validation: "EN_ATTENTE" as const }, { validation: "BROUILLON" as const, createdAt: { lt: staleBefore } }],
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

/** L1d: à brancher sur F1 — file « Accompagnants à appeler » (D15). Les plus anciens d'abord. */
export async function listCaregiversToCall(now: Date = new Date()) {
  return db.caregiverProfile.findMany({
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
}
