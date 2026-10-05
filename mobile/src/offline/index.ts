import { assemblerHorsLigne, type HorsLigne } from './horsligne';
import type { Transport } from './file';
import { creerPlateforme } from './plateforme';
import { surveillerReseau } from './reseau';

export type { CacheHorsLigne } from './cache';
export { estDuJour } from './cache';
export type { EtatFile, FileEvenements, Refus, Transport } from './file';
export { classerErreur, messageAttente } from './file';
export type { EtatHorsLigne, HorsLigne, HorsLigneVue, Surveiller } from './horsligne';
export { assemblerHorsLigne } from './horsligne';

/**
 * Lot M3 — hors ligne. Point d'entrée utilisé par `api/http.ts`.
 *
 * ```mermaid
 * flowchart LR
 *   E[Écran] -->|api.publierKaye…| H[http.ts envoyer]
 *   H -->|soumettre| F[(File : SQLite chiffrée / mémoire web)]
 *   F -->|un par un, même clientEventId| S[POST /evenements]
 *   R[Retour réseau / réouverture / nouvelle action] --> F
 * ```
 *
 * Plateforme : `plateforme.native.ts` (SQLite + AES-GCM) ou `plateforme.ts` (web, mémoire).
 */
export function creerHorsLigne(o: { transport: Transport }): HorsLigne {
  return assemblerHorsLigne({ transport: o.transport, plateforme: creerPlateforme(), surveiller: surveillerReseau });
}
