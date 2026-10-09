import "server-only";
import type { Role, Territoire } from "@prisma/client";
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
export function accountTerritoire(user: {
  role: Role;
  caregiverProfile?: { territoire: Territoire } | null;
  ownedAines?: { territoire: Territoire }[];
}): Territoire | null {
  if (user.role === "ACCOMPAGNANT") return user.caregiverProfile?.territoire ?? null;
  if (user.role === "FAMILLE") return user.ownedAines?.[0]?.territoire ?? null;
  return null;
}
