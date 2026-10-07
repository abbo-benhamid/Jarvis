/**
 * L1-B (R1/R5) : interface LOCALE des garde-fous du lancement, en attendant `realDataAllowed()` de l'agent A.
 * [À VÉRIFIER] À réconcilier à la fusion : remplacer `realDataAllowedLocal()` par la fonction de l'agent A,
 * et `aineConsentRecorded()` par l'état `EN_ATTENTE_ACCORD` de l'aîné.
 *
 * Règle : l'adresse, la carte domicile (QR signé) et le trajet en direct sont REFUSÉS
 * - en production stricte tant que `DONNEES_REELLES_AUTORISEES` ne vaut pas "true" (pilote réel non autorisé :
 *   hébergement HDS et analyse d'impact pas faits) — sauf pour un aîné de bac à sable (données fictives) ;
 * - pour un aîné dont l'accord n'est pas enregistré.
 * Fichier PUR (sans base) : testable seul.
 */

type Env = Record<string, string | undefined>;

function isStrict(env: Env): boolean {
  return env.VERCEL_ENV === "production" || env.KOUDMEN_STRICT_CONFIG === "true";
}

/** Données réelles permises : toujours hors production stricte ; en production, seulement avec le drapeau. */
export function realDataAllowedLocal(env: Env = process.env): boolean {
  if (!isStrict(env)) return true;
  return env.DONNEES_REELLES_AUTORISEES?.trim() === "true";
}

/** L'accord de l'aîné (ou de son représentant) est enregistré. */
export function aineConsentRecorded(aine: { consentGiven: boolean; consentAt?: Date | null }): boolean {
  return aine.consentGiven === true && (aine.consentAt === undefined || aine.consentAt !== null);
}

export type PresenceGuardAine = { consentGiven: boolean; consentAt?: Date | null; sandboxId: string | null };

export type PresenceRefusal = "DONNEES_REELLES_NON_AUTORISEES" | "ACCORD_MANQUANT";

export const PRESENCE_REFUSAL_MESSAGES: Record<PresenceRefusal, string> = {
  DONNEES_REELLES_NON_AUTORISEES: "Cette fonction n'est pas encore ouverte : le pilote avec de vraies données n'est pas autorisé.",
  ACCORD_MANQUANT: "L'accord de l'aîné n'est pas enregistré. Enregistrez-le d'abord dans son profil.",
};

/** Null si l'adresse, la carte domicile et le trajet sont permis pour cet aîné ; sinon le motif du refus. */
export function presenceRefusal(aine: PresenceGuardAine, env: Env = process.env): PresenceRefusal | null {
  if (aine.sandboxId === null && !realDataAllowedLocal(env)) return "DONNEES_REELLES_NON_AUTORISEES";
  if (!aineConsentRecorded(aine)) return "ACCORD_MANQUANT";
  return null;
}
