import { creerCache, type CacheHorsLigne } from './cache';
import { creerFile, type EtatFile, type FileEvenements, type Transport } from './file';
import type { Plateforme } from './plateforme.types';

/** Surveillance du réseau : `surEtat(enLigne)`, `surReprise()`. Renvoie la fonction d'arrêt (voir `reseau.ts`). */
export type Surveiller = (surEtat: (enLigne: boolean | null) => void, surReprise: () => void) => () => void;

export type EtatHorsLigne = EtatFile & {
  /** `false` : l'appareil n'a pas de réseau. `null` : inconnu. */
  enLigne: boolean | null;
};

/** Ce que les écrans voient (indicateur, profil). */
export interface HorsLigneVue {
  etat(): EtatHorsLigne;
  abonner(cb: (etat: EtatHorsLigne) => void): () => void;
  /** Relance l'envoi tout de suite. */
  synchroniser(): Promise<void>;
  oublierRefus(id?: string): Promise<void>;
  readonly description: string;
}

export interface HorsLigne extends HorsLigneVue {
  readonly file: FileEvenements;
  readonly cache: CacheHorsLigne;
  /**
   * Session ouverte (connexion, reprise, ou reprise sans réseau).
   * Un autre compte que le précédent : tout est effacé d'abord (jamais d'envoi au nom d'un autre).
   * Puis : surveillance du réseau et envoi de ce qui attend.
   */
  ouvrir(compteId: string): Promise<void>;
  /** Déconnexion : purge complète du cache, de la file et de la clé de chiffrement. */
  purger(): Promise<void>;
}

const CLE_COMPTE = 'compte';

export function assemblerHorsLigne(o: { transport: Transport; plateforme: Plateforme; surveiller: Surveiller }): HorsLigne {
  const plateforme = o.plateforme;
  const { stockage } = plateforme;
  const file = creerFile({ stockage, transport: o.transport });
  const cache = creerCache(stockage);
  const surveiller = o.surveiller;

  let enLigne: boolean | null = null;
  let arreter: (() => void) | null = null;
  const abonnes = new Set<(e: EtatHorsLigne) => void>();

  const etat = (): EtatHorsLigne => ({ ...file.etat(), enLigne });
  const notifier = () => {
    const e = etat();
    for (const cb of abonnes) cb(e);
  };
  file.abonner(notifier);

  async function purger() {
    file.vider();
    await stockage.toutEffacer().catch(() => undefined);
    await plateforme.oublierCle().catch(() => undefined);
  }

  return {
    file,
    cache,
    description: plateforme.description,
    etat,

    abonner(cb) {
      abonnes.add(cb);
      cb(etat());
      return () => {
        abonnes.delete(cb);
      };
    },

    synchroniser: () => file.synchroniser({ forcer: true }),
    oublierRefus: (id) => file.oublierRefus(id),

    async ouvrir(compteId) {
      const avant = await stockage.lireMeta(CLE_COMPTE).catch(() => null);
      if (avant && avant !== compteId) await purger();
      await stockage.ecrireMeta(CLE_COMPTE, compteId).catch(() => undefined);
      if (!arreter) {
        arreter = surveiller(
          (x) => {
            enLigne = x;
            notifier();
          },
          () => void file.synchroniser({ forcer: true }),
        );
      }
      void file.synchroniser({ forcer: true });
    },

    async purger() {
      arreter?.();
      arreter = null;
      enLigne = null;
      await purger();
      notifier();
    },
  };
}
