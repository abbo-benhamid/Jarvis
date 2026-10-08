import { z } from 'zod';
import { reponseVisiteSchema, visiteSchema, type ReponseVisite, type Visite } from '../contracts';
// L1 : compte avec `emailVerifie`, `profilValide`, `preinscription` (contrat provisoire).
import { reponseMoiSchema, type ReponseMoi } from '../contracts';
import type { StockageHorsLigne } from './types';

/**
 * Cache de lecture hors ligne (lot M3).
 *
 * Minimum utile (RGPD, ADR 0008 § 4.2) :
 * - les visites DU JOUR seulement (pas les 7 jours) ;
 * - la fiche de chaque visite du jour (consignes, brouillon synchronisé) ;
 * - le compte connecté (`/me`), pour rouvrir l'app sans réseau.
 * Durée : 24 h pour les visites. Tout est effacé à la déconnexion.
 * Sur iOS / Android, chaque valeur est chiffrée au repos (`chiffre.ts`).
 * Chaque lecture repasse par le schéma Zod du contrat : une donnée hors contrat est ignorée.
 */

export const DUREE_CACHE_VISITES_MS = 24 * 3_600_000;

const CLE_MOI = 'moi';
const CLE_VISITES = 'visites';
const cleVisite = (id: string) => `visite:${id}`;

/** Visite qui touche la journée locale en cours (commence avant minuit ce soir et finit après minuit ce matin). */
export function estDuJour(v: Pick<Visite, 'debut' | 'fin'>, maintenant: number): boolean {
  const matin = new Date(maintenant);
  matin.setHours(0, 0, 0, 0);
  const soir = new Date(matin);
  soir.setDate(soir.getDate() + 1);
  return Date.parse(v.fin) >= matin.getTime() && Date.parse(v.debut) < soir.getTime();
}

export interface CacheHorsLigne {
  garderMoi(moi: ReponseMoi): Promise<void>;
  lireMoi(): Promise<ReponseMoi | null>;
  /** Garde les visites du jour. Renvoie celles qui sont gardées. */
  garderVisites(visites: Visite[]): Promise<Visite[]>;
  lireVisites(): Promise<Visite[] | null>;
  garderVisite(v: ReponseVisite): Promise<void>;
  lireVisite(id: string): Promise<ReponseVisite | null>;
}

export function creerCache(stockage: StockageHorsLigne, maintenant: () => number = Date.now): CacheHorsLigne {
  async function lire<T>(cle: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, dureeMax: number | null): Promise<T | null> {
    const e = await stockage.lireCache(cle).catch(() => null);
    if (!e) return null;
    if (dureeMax !== null && maintenant() - e.enregistreA > dureeMax) {
      await stockage.effacerCache(cle).catch(() => undefined);
      return null;
    }
    try {
      const r = schema.safeParse(JSON.parse(e.valeur));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  }

  async function ecrire(cle: string, valeur: unknown) {
    await stockage.ecrireCache(cle, { valeur: JSON.stringify(valeur), enregistreA: maintenant() }).catch(() => undefined);
  }

  return {
    garderMoi: (moi) => ecrire(CLE_MOI, moi),
    // Pas de durée : le jeton de renouvellement (30 j) décide si la session est encore valable.
    lireMoi: () => lire(CLE_MOI, reponseMoiSchema, null),

    async garderVisites(visites) {
      const duJour = visites.filter((v) => estDuJour(v, maintenant()));
      await ecrire(CLE_VISITES, duJour);
      return duJour;
    },
    async lireVisites() {
      const v = await lire(CLE_VISITES, z.array(visiteSchema), DUREE_CACHE_VISITES_MS);
      return v ? v.filter((x) => estDuJour(x, maintenant())) : null;
    },

    async garderVisite(v) {
      if (estDuJour(v, maintenant())) await ecrire(cleVisite(v.id), v);
      else await stockage.effacerCache(cleVisite(v.id)).catch(() => undefined);
    },
    async lireVisite(id) {
      const v = await lire(cleVisite(id), reponseVisiteSchema, DUREE_CACHE_VISITES_MS);
      return v && estDuJour(v, maintenant()) ? v : null;
    },
  };
}
