import { stockageMemoire } from './memoire';
import type { Plateforme } from './plateforme.types';

/**
 * Web (export statique) : stockage en MÉMOIRE, derrière la même interface que SQLite.
 *
 * Pourquoi pas IndexedDB : sur le web, le jeton de renouvellement reste déjà en mémoire (`api/stockage.ts`).
 * Recharger la page demande de se reconnecter. Garder un Kayé dans le navigateur, sans clé sûre pour le chiffrer,
 * serait moins protégé que sur le téléphone. Donc : rien au repos sur le web.
 * Effet : la file et le cache tiennent tant que l'onglet est ouvert (coupure réseau, retour du réseau).
 */
export function creerPlateforme(): Plateforme {
  return {
    stockage: stockageMemoire(),
    oublierCle: async () => undefined,
    description: 'mémoire de l’onglet (rien n’est écrit dans le navigateur)',
  };
}
