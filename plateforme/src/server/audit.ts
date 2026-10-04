import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { db, type DbClient } from "@/server/db";

export type AuditInput = {
  actor?: { id: string; role: Role } | null;
  /** Notation pointée : "caregiver.validate", "visit.proof.recorded", "plan.changed"… */
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Journalise une action sensible. Obligatoire pour : connexion, validation/refus
 * d'accompagnant, proposition, acceptation/refus, preuve de visite, changement de
 * formule, consentement, invitation. Ne jamais mettre de mot de passe ni de donnée de santé.
 */
export async function logAudit(input: AuditInput, client: DbClient = db): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorRole: input.actor?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
