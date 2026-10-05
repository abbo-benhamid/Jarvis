import type { EntreeCache, LigneStockee, StockageHorsLigne } from './types';

/**
 * Stockage en MÉMOIRE : web et tests.
 * Web : rien n'est écrit dans le navigateur (même règle que le jeton de renouvellement, `api/stockage.ts`).
 * Conséquence : recharger la page perd le cache et la file. Recharger demande aussi de se reconnecter.
 */
export function stockageMemoire(): StockageHorsLigne & { brut(): { cache: Map<string, EntreeCache>; lignes: Map<string, LigneStockee> } } {
  const cache = new Map<string, EntreeCache>();
  const lignes = new Map<string, LigneStockee>();
  const meta = new Map<string, string>();
  return {
    lireCache: async (cle) => cache.get(cle) ?? null,
    ecrireCache: async (cle, entree) => {
      cache.set(cle, { ...entree });
    },
    effacerCache: async (cle) => {
      cache.delete(cle);
    },
    listerLignes: async () => [...lignes.values()].map((l) => ({ ...l })).sort((a, b) => a.seq - b.seq),
    ecrireLigne: async (l) => {
      lignes.set(l.id, { ...l });
    },
    supprimerLigne: async (id) => {
      lignes.delete(id);
    },
    lireMeta: async (cle) => meta.get(cle) ?? null,
    ecrireMeta: async (cle, v) => {
      meta.set(cle, v);
    },
    toutEffacer: async () => {
      cache.clear();
      lignes.clear();
      meta.clear();
    },
    brut: () => ({ cache, lignes }),
  };
}
