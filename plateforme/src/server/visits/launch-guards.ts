/**
 * L1-B (R1/R5) : garde-fous du lancement pour l'adresse, la carte domicile (QR signé) et le trajet en direct.
 * Fusion L1-A : les règles viennent de l'agent A :
 * - R1 `realDataAllowedFrom()` (config-check) : mode essai → permis ; mode lancement → seulement avec
 *   DONNEES_REELLES_AUTORISEES=true + HEBERGEUR_HDS + AIPD_DATE + DPO_CONTACT (sinon PRÉINSCRIPTION) ;
 * - R5 : l'accord de l'aîné est ACCORD_RECUEILLI (enregistré par un conseiller après l'appel).
 * Un aîné de bac à sable (données fictives, mode essai) reste permis.
 * Fichier PUR (sans base) : testable seul. `GET /api/v1/me.preinscription` = !realDataAllowed() : même règle.
 */
import { realDataAllowedFrom } from "@/server/config-check";

type Env = Record<string, string | undefined>;

/** R1 : données réelles des aînés permises (même règle que `realDataAllowed()` de `src/server/launch.ts`). */
export function realDataAllowedLocal(env: Env = process.env): boolean {
  return realDataAllowedFrom(env);
}

/**
 * R5 : l'accord de l'aîné est recueilli. `accordEtat` (L1-A) fait foi ; sans lui (ancien appelant),
 * repli sur `consentGiven`.
 */
export function aineConsentRecorded(aine: { accordEtat?: string | null; consentGiven: boolean; consentAt?: Date | null }): boolean {
  if (aine.accordEtat !== undefined && aine.accordEtat !== null) return aine.accordEtat === "ACCORD_RECUEILLI";
  return aine.consentGiven === true && (aine.consentAt === undefined || aine.consentAt !== null);
}

export type PresenceGuardAine = { accordEtat?: string | null; consentGiven: boolean; consentAt?: Date | null; sandboxId: string | null };

export type PresenceRefusal = "DONNEES_REELLES_NON_AUTORISEES" | "ACCORD_MANQUANT";

export const PRESENCE_REFUSAL_MESSAGES: Record<PresenceRefusal, string> = {
  DONNEES_REELLES_NON_AUTORISEES: "Koudmen ouvre bientôt. Nous vous contactons dès l'ouverture.",
  ACCORD_MANQUANT: "L'accord de l'aîné n'est pas encore recueilli. Un conseiller Koudmen l'appelle d'abord.",
};

/** Null si l'adresse, la carte domicile et le trajet sont permis pour cet aîné ; sinon le motif du refus. */
export function presenceRefusal(aine: PresenceGuardAine, env: Env = process.env): PresenceRefusal | null {
  if (aine.sandboxId === null && !realDataAllowedLocal(env)) return "DONNEES_REELLES_NON_AUTORISEES";
  if (!aineConsentRecorded(aine)) return "ACCORD_MANQUANT";
  return null;
}
