import { assertProductionConfig } from "@/server/config-check";

/**
 * Exécuté une fois au démarrage du serveur (Node et edge).
 * B1, B3 : en production, l'application REFUSE de démarrer avec une valeur d'exemple,
 * une valeur de CI ou un secret trop court (SESSION_SECRET, CRON_SECRET, TESTER_INVITE_CODES).
 */
export function register(): void {
  assertProductionConfig();
}
