import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { readSession } from "./session";
import { ROLE_HOME } from "@/lib/labels";
import { isDemoMode } from "@/server/env";

/** Champs sûrs de l'utilisateur courant (jamais le hash du mot de passe). */
export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isDemo: boolean;
  /** Bac à sable du testeur (D2). Null = monde réel. */
  sandboxId: string | null;
};

/**
 * Utilisateur connecté ou null. Mis en cache pour la durée d'une requête.
 * - M7 : la version de session du jeton doit être celle du compte (la déconnexion l'incrémente).
 * - m5 : un compte démo est refusé hors du mode démo, même avec une session déjà ouverte.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, isDemo: true, sandboxId: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.sv) return null;
  if (user.isDemo && !isDemoMode()) return null;
  const { sessionVersion: _sv, ...safe } = user;
  return safe;
});

/** Exige une connexion. Sinon : redirection vers /connexion. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/**
 * Exige un des rôles donnés. À appeler en tête de CHAQUE page protégée,
 * de CHAQUE Server Action et de CHAQUE route handler protégé.
 * - Pas connecté → /connexion.
 * - Mauvais rôle → page d'accueil de son propre rôle.
 * - OPERATEUR : seulement un VRAI opérateur (D1). Un compte démo ou un compte de bac à sable
 *   n'ouvre jamais l'espace opérateur.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  if (user.role === "OPERATEUR" && !isRealOperator(user)) redirect("/connexion?erreur=operateur");
  return user;
}

/** Un vrai opérateur : créé par `pnpm ops:create-operator`, ni démo, ni bac à sable. */
export function isRealOperator(user: Pick<CurrentUser, "role" | "isDemo" | "sandboxId">): boolean {
  return user.role === "OPERATEUR" && !user.isDemo && user.sandboxId === null;
}
