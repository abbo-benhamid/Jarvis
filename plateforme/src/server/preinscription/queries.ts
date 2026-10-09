import "server-only";
import { db } from "@/server/db";
import { phraseOuverture, rangDansFile, rangDepuisCompte, type EntreeFile } from "@/lib/preinscription";

/**
 * P1 : place dans la liste d'ouverture (familles) et dans la file de validation (accompagnants).
 * On ne renvoie qu'un NOMBRE : aucune autre donnée de la file n'est lue ni montrée.
 * Comptes de démo et de bac à sable : hors des files (rang null).
 */

/** Phrase d'ouverture à partir de la variable `OUVERTURE_PREVUE` (« bientôt » si absente ou passée). */
export function ouvertureFamille(now: Date = new Date()): string {
  return phraseOuverture(process.env.OUVERTURE_PREVUE, now);
}

/**
 * Rang de la famille sur la liste d'ouverture : ordre d'inscription des comptes famille réels.
 * Au lancement, un seul territoire est ouvert (Guadeloupe) : une seule liste.
 */
export async function rangFamille(userId: string): Promise<number | null> {
  const me = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, createdAt: true, isDemo: true, sandboxId: true } });
  if (!me || me.role !== "FAMILLE" || me.isDemo || me.sandboxId) return null;
  const avant = await db.user.count({
    where: {
      role: "FAMILLE",
      isDemo: false,
      sandboxId: null,
      OR: [{ createdAt: { lt: me.createdAt } }, { createdAt: me.createdAt, id: { lt: me.id } }],
    },
  });
  return rangDepuisCompte(avant);
}

/** Taille maximale de la file lue (sécurité). Au-delà, le rang n'est pas affiché. */
const FILE_MAX = 5_000;

/**
 * Rang de l'accompagnant dans la file de validation : dossiers EN_ATTENTE, du plus ancien au plus récent.
 * Date d'entrée = dernière demande de vérification (journal `caregiver.submitted`), sinon la dernière mise à jour du profil.
 * Null si le dossier n'est pas en attente.
 */
export async function rangValidation(userId: string): Promise<number | null> {
  const pending = await db.caregiverProfile.findMany({
    where: { validation: "EN_ATTENTE", user: { isDemo: false, sandboxId: null } },
    select: { id: true, userId: true, updatedAt: true },
    take: FILE_MAX + 1,
  });
  if (pending.length > FILE_MAX) return null;
  const mine = pending.find((p) => p.userId === userId);
  if (!mine) return null;
  const logs = await db.auditLog.groupBy({
    by: ["entityId"],
    where: { action: "caregiver.submitted", entityType: "CaregiverProfile", entityId: { in: pending.map((p) => p.id) } },
    _max: { createdAt: true },
  });
  const sent = new Map(logs.map((l) => [l.entityId, l._max.createdAt]));
  const file: EntreeFile[] = pending.map((p) => ({ id: p.id, depuis: sent.get(p.id) ?? p.updatedAt }));
  return rangDansFile(file, mine.id);
}
