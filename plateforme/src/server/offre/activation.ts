import "server-only";
import type { ActivationStatus, Plan, Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { addMonths } from "@/server/sandbox/purge";

/**
 * L4 / R8 : demande de RAPPEL pour une formule payante (pas une commande, J32).
 * - Aucun encaissement, aucun paiement simulé en mode lancement.
 * - Seul un compte FAMILLE (réel) demande ; un accompagnant ne paie jamais rien (J27).
 * - Une seule demande ouverte par compte, aîné et formule (pas de doublon).
 * - J35 : une demande sans suite est effacée 3 mois après sa dernière mise à jour.
 * - L1d (M4) : téléphone et créneau donnés dans la demande ; `plan = null` = « poser une question » (sans formule).
 */

export const ACTIVATION_RETENTION_MONTHS = 3;

export class ActivationError extends Error {}

type Requester = { id: string; role: Role; isDemo: boolean; sandboxId: string | null };

export async function requestActivation(
  user: Requester,
  input: { plan: Plan | null; aineId: string | null; phone?: string | null; creneau?: string | null },
): Promise<{ created: boolean; id: string }> {
  if (user.role !== "FAMILLE") throw new ActivationError("Seul un compte famille demande un appel.");
  if (input.plan === "LAKOU") throw new ActivationError("La formule Libre est gratuite : aucun appel n'est nécessaire.");
  if (input.aineId) {
    const member = await db.lakouMember.findUnique({ where: { aineId_userId: { aineId: input.aineId, userId: user.id } }, select: { isPayer: true } });
    if (!member) throw new ActivationError("Nous ne trouvons pas cet aîné dans votre cercle Lakou.");
    if (!member.isPayer) throw new ActivationError("Seul le payeur peut demander une formule.");
  }
  const open = await db.planActivationRequest.findFirst({
    where: { userId: user.id, aineId: input.aineId, plan: input.plan, status: "NOUVELLE" },
    select: { id: true },
  });
  if (open) {
    // Le numéro ou le créneau peut changer : la dernière demande fait foi.
    if (input.phone || input.creneau) await db.planActivationRequest.update({ where: { id: open.id }, data: { phone: input.phone ?? undefined, creneau: input.creneau ?? undefined } });
    return { created: false, id: open.id };
  }
  const created = await db.planActivationRequest.create({
    data: { userId: user.id, aineId: input.aineId, plan: input.plan, phone: input.phone ?? null, creneau: input.creneau ?? null },
    select: { id: true },
  });
  // Jamais le numéro dans le journal.
  await logAudit({ actor: user, action: "plan.activation_requested", entityType: "PlanActivationRequest", entityId: created.id, metadata: { plan: input.plan ?? "QUESTION", avecAine: Boolean(input.aineId), creneau: input.creneau ?? null } });
  return { created: true, id: created.id };
}

/** Conseiller : « appel fait » (RAPPELEE) ou « clore » (CLOSE). Jamais d'activation payante sans CGV (J32). */
export async function handleActivation(operator: { id: string; role: Role }, id: string, status: Exclude<ActivationStatus, "NOUVELLE">, now: Date = new Date()): Promise<boolean> {
  const res = await db.planActivationRequest.updateMany({
    where: { id, status: { not: "CLOSE" } },
    data: { status, handledById: operator.id, handledAt: now },
  });
  if (res.count !== 1) return false;
  await logAudit({ actor: operator, action: status === "RAPPELEE" ? "plan.activation_called" : "plan.activation_closed", entityType: "PlanActivationRequest", entityId: id });
  return true;
}

/** Demandes de rappel visibles par l'opérateur (ouvertes d'abord). Contact : prénom, nom, téléphone, e-mail. */
export async function listActivations() {
  return db.planActivationRequest.findMany({
    where: { status: { in: ["NOUVELLE", "RAPPELEE"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      plan: true,
      status: true,
      createdAt: true,
      handledAt: true,
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      phone: true,
      creneau: true,
      aine: { select: { firstName: true, commune: true } },
    },
  });
}

/** Demandes ouvertes d'un compte famille (affichage « demande envoyée »). */
export async function openActivationsFor(userId: string) {
  return db.planActivationRequest.findMany({ where: { userId, status: "NOUVELLE" }, select: { plan: true, aineId: true, createdAt: true } });
}

/** J35 : purge des demandes sans suite (aucune action depuis 3 mois). */
export async function purgeActivations(now: Date = new Date()): Promise<number> {
  const r = await db.planActivationRequest.deleteMany({ where: { updatedAt: { lt: addMonths(now, -ACTIVATION_RETENTION_MONTHS) } } });
  return r.count;
}
