import "server-only";
import type { Role, Territoire } from "@prisma/client";
import { db } from "@/server/db";
import { isOuvert, territoire, TERRITOIRES_OUVERTS, listeNoms } from "@/lib/territoires";

/**
 * T1 : règles serveur des territoires (ouverture, territoire d'un compte).
 * Le formulaire ne fait jamais foi : chaque création (aîné, demande, mission, zone d'intervention) passe ici.
 */

/** Message STE quand un territoire n'est pas encore ouvert. */
export function messageTerritoireFerme(code: Territoire): string {
  const t = territoire(code);
  return `Koudmen n'est pas encore ouvert ${t.enNom}. Koudmen ouvre d'abord ${territoire(TERRITOIRES_OUVERTS[0] ?? "GUADELOUPE").enNom}. Inscrivez-vous sur la liste d'attente : nous vous prévenons à l'ouverture.`;
}

/** Null si le territoire est ouvert ; sinon le message à afficher. */
export function territoireFermeProbleme(code: Territoire): string | null {
  return isOuvert(code) ? null : messageTerritoireFerme(code);
}

/** « Koudmen ouvre en Guadeloupe » : territoires ouverts, pour les textes. */
export function nomsOuverts(): string {
  return listeNoms(TERRITOIRES_OUVERTS);
}

/**
 * Territoire d'un compte (GET /api/v1/me) :
 * - accompagnant : territoire de sa zone d'intervention (null sans profil) ;
 * - famille : territoire du premier aîné du compte (null sans aîné) ;
 * - opérateur : null.
 */
export async function accountTerritoire(user: { id: string; role: Role }): Promise<Territoire | null> {
  if (user.role === "ACCOMPAGNANT") {
    const p = await db.caregiverProfile.findUnique({ where: { userId: user.id }, select: { territoire: true } });
    return p?.territoire ?? null;
  }
  if (user.role === "FAMILLE") {
    const a = await db.aine.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { territoire: true } });
    return a?.territoire ?? null;
  }
  return null;
}
