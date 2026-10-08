import type { CodeErreur } from "@/contracts/v1/erreurs";

/** Erreur métier de la vérification : `message` s'affiche tel quel ; `code` est le code de l'API v1. */
export class VerificationError extends Error {
  constructor(
    message: string,
    readonly code: CodeErreur = "ACTION_IMPOSSIBLE",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "VerificationError";
  }
}
