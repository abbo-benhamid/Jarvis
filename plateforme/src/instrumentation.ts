import { productionConfigProblems } from "@/server/config-check";

/**
 * Exécuté une fois au démarrage du serveur (Node et edge).
 * B1, B3 : en production, une configuration refusée (secret d'exemple, code testeur public…)
 * est journalisée ici ; le middleware bloque alors TOUTES les pages avec une page 503 explicite
 * (noms des variables seulement, jamais leurs valeurs). Voir aussi /api/sante.
 */
export function register(): void {
  const problems = productionConfigProblems();
  if (problems.length > 0) {
    console.error(`Configuration de production refusée :\n- ${problems.join("\n- ")}`);
  }
}
