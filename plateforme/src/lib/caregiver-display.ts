import type { CaregiverStatus } from "@prisma/client";

/**
 * Nom d'un accompagnant montré à une FAMILLE (D8).
 * - Un SAAD s'affiche comme « Structure partenaire », jamais comme une personne :
 *   le SAAD désigne lui-même son intervenant.
 * - Une personne : prénom + initiale du nom (minimisation).
 */
export function caregiverDisplayName(c: {
  status: CaregiverStatus | null;
  saadName?: string | null;
  user: { firstName: string; lastName?: string | null };
}): string {
  if (c.status === "SAAD") return `Structure partenaire : ${c.saadName?.trim() || "SAAD"}`;
  const initial = c.user.lastName?.trim().charAt(0);
  return initial ? `${c.user.firstName} ${initial}.` : c.user.firstName;
}

/** Mention des vérifications pendant le test (D5) : jamais « vérifié ». */
export const VERIFICATIONS_TEST_LABEL = "Vérifications déclarées (test)";
