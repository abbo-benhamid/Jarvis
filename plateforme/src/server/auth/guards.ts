import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { readSession } from "./session";
import { ROLE_HOME } from "@/lib/labels";

/** Champs sûrs de l'utilisateur courant (jamais le hash du mot de passe). */
export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isDemo: boolean;
};

/** Utilisateur connecté ou null. Mis en cache pour la durée d'une requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, isDemo: true },
  });
  return user;
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
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
