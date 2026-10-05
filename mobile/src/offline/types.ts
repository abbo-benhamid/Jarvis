/**
 * Lot M3 — hors ligne. Types communs, SANS dépendance à Expo ni à React Native
 * (les modules purs `file.ts`, `cache.ts`, `chiffre.ts` sont testés sous Node).
 */

/** Statut d'une ligne de la file. Une ligne envoyée avec succès est SUPPRIMÉE (pas de statut « envoyé »). */
export type StatutLigne = 'EN_ATTENTE' | 'REFUSE';

/**
 * Ligne de la file, telle que le stockage la garde.
 * `contenu` est du JSON. Le stockage chiffré (`chiffre.ts`) le chiffre au repos :
 * il contient le Kayé (donnée de santé), le code du domicile ou la position.
 * Les autres colonnes sont en clair : identifiants opaques, type, compteurs.
 */
export type LigneStockee = {
  /** = `clientEventId` de l'événement. Le même identifiant sert à chaque renvoi. */
  id: string;
  /** Ordre d'arrivée dans la file (croissant). */
  seq: number;
  type: string;
  visiteId: string | null;
  statut: StatutLigne;
  /** Nombre d'envois déjà essayés (réseau en échec). */
  tentatives: number;
  contenu: string;
};

export type EntreeCache = { valeur: string; enregistreA: number };

/**
 * Interface unique de stockage hors ligne.
 * - iOS / Android : SQLite (`plateforme.native.ts`), données sensibles chiffrées (AES-GCM, clé dans expo-secure-store).
 * - Web : mémoire (`memoire.ts`), comme le jeton de renouvellement (rien ne reste dans le navigateur).
 * - Tests : mémoire.
 */
export interface StockageHorsLigne {
  lireCache(cle: string): Promise<EntreeCache | null>;
  ecrireCache(cle: string, entree: EntreeCache): Promise<void>;
  effacerCache(cle: string): Promise<void>;

  /** Toutes les lignes, triées par `seq`. */
  listerLignes(): Promise<LigneStockee[]>;
  /** Ajoute ou remplace (même `id`). */
  ecrireLigne(ligne: LigneStockee): Promise<void>;
  supprimerLigne(id: string): Promise<void>;

  /** Petites valeurs en clair (identifiant opaque du compte propriétaire). */
  lireMeta(cle: string): Promise<string | null>;
  ecrireMeta(cle: string, valeur: string): Promise<void>;

  /** Efface TOUT : cache, file, méta (déconnexion). */
  toutEffacer(): Promise<void>;
}

/** Chiffrement au repos d'un texte. Lève une erreur si le texte chiffré est illisible (clé changée). */
export interface Chiffreur {
  chiffrer(texte: string): Promise<string>;
  dechiffrer(texteChiffre: string): Promise<string>;
}

/** Programmation d'un appel différé (injectable pour les tests). Renvoie la fonction d'annulation. */
export type Planifier = (fn: () => void, ms: number) => () => void;

export const planifierParDefaut: Planifier = (fn, ms) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};
