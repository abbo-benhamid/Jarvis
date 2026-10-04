import "server-only";

/**
 * Cloisonnement des bacs à sable (D2).
 * - Un « monde » = un bac à sable (sandboxId) ou le monde réel (null).
 * - Une donnée d'un monde n'est JAMAIS lue ni modifiée depuis un autre monde.
 * - L'opérateur réel travaille seulement dans le monde réel (REAL_WORLD).
 * Les filtres Prisma ci-dessous s'ajoutent à TOUTES les requêtes transverses
 * (espace opérateur, matching, invitations, robots).
 */
export type Scope = string | null;

/** Le monde réel (comptes et aînés sans bac à sable). */
export const REAL_WORLD: Scope = null;

export function scopeOf(user: { sandboxId: string | null }): Scope {
  return user.sandboxId ?? null;
}

/** Filtre d'un aîné (et de tout ce qui pend à un aîné : demandes, visites, Kayé). */
export function aineScope(scope: Scope) {
  return { sandboxId: scope };
}

/** Filtre d'un compte (et de tout ce qui pend à un compte : profil accompagnant). */
export function userScope(scope: Scope) {
  return { sandboxId: scope };
}

/** true si deux éléments appartiennent au même monde. */
export function sameScope(a: Scope | undefined, b: Scope | undefined): boolean {
  return (a ?? null) === (b ?? null);
}
