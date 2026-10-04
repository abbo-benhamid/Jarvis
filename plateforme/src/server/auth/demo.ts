import type { Role } from "@prisma/client";

/**
 * Comptes de démonstration PARTAGÉS créés par prisma/seed.ts (données fictives).
 * Réservés aux démos en direct du fondateur. Les testeurs utilisent un bac à sable (D2).
 * D1 : aucun compte démo « Opérateur ». Le mot de passe démo vient de la variable DEMO_PASSWORD
 * (jamais dans le code), et ces comptes sont refusés si DEMO_MODE != "true".
 */
export type DemoRole = Exclude<Role, "OPERATEUR">;

export const DEMO_ACCOUNTS: Record<DemoRole, { email: string; label: string }> = {
  FAMILLE: { email: "famille@demo.koudmen.test", label: "Sandrine (famille, Paris)" },
  ACCOMPAGNANT: { email: "accompagnant@demo.koudmen.test", label: "Josiane (accompagnante, Fort-de-France)" },
};
