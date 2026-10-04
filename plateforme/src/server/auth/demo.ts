import type { Role } from "@prisma/client";

/** Comptes de démonstration créés par prisma/seed.ts. Données fictives. */
export const DEMO_ACCOUNTS: Record<Role, { email: string; label: string }> = {
  FAMILLE: { email: "famille@demo.koudmen.test", label: "Sandrine (famille, Paris)" },
  ACCOMPAGNANT: { email: "accompagnant@demo.koudmen.test", label: "Josiane (accompagnante, Fort-de-France)" },
  OPERATEUR: { email: "operateur@demo.koudmen.test", label: "Équipe Koudmen (opérateur)" },
};

/** Mot de passe commun des comptes seedés (connexion classique possible aussi). */
export const DEMO_PASSWORD = "demo-koudmen-2026";
