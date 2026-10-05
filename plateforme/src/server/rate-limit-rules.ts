/**
 * Règles des limites de débit (M4, M5). Pur et testable.
 * Les valeurs restent larges pour un vrai testeur (ex. 10 testeurs derrière la même box d'une médiathèque),
 * et bloquent les essais en masse (dictionnaire de codes, avis ou événements en boucle).
 */
export const RATE_RULES = {
  /** Connexion : par IP, puis par compte visé (email). */
  "login:ip": { limit: 20, windowSeconds: 15 * 60 },
  "login:compte": { limit: 10, windowSeconds: 15 * 60 },
  /** Code testeur (« Tester Koudmen », /inscription en mode démo) : tous les essais, par IP. */
  "code-testeur:ip": { limit: 30, windowSeconds: 60 * 60 },
  /** Avis : anonyme par IP, connecté par compte. */
  "avis:ip": { limit: 5, windowSeconds: 60 * 60 },
  "avis:compte": { limit: 20, windowSeconds: 60 * 60 },
  /** Mesure d'usage (pages vues) : toutes les vues par IP, et les vues anonymes par IP. */
  "evenement:ip": { limit: 120, windowSeconds: 60 },
  "evenement-anonyme:ip": { limit: 10, windowSeconds: 60 },
  /** Offre « visite découverte » (contact réel) : par compte et par IP. */
  "decouverte:compte": { limit: 3, windowSeconds: 24 * 60 * 60 },
  "decouverte:ip": { limit: 10, windowSeconds: 24 * 60 * 60 },
  /** Retrait du consentement par lien : par IP (le jeton est long, mais on limite l'essai en masse). */
  "retrait:ip": { limit: 20, windowSeconds: 60 * 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateRuleName = keyof typeof RATE_RULES;

export function rateLimitKey(rule: RateRuleName, subjectHash: string): string {
  return `${rule}:${subjectHash}`;
}

/** Message STE pour l'utilisateur : « Trop d'essais. Réessayez dans 12 minutes. » */
export function retryMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes <= 1) return "Trop d'essais. Réessayez dans une minute.";
  if (minutes < 120) return `Trop d'essais. Réessayez dans ${minutes} minutes.`;
  return `Trop d'essais. Réessayez dans ${Math.ceil(minutes / 60)} heures.`;
}
