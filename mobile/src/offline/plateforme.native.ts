import { AESEncryptionKey, AESKeySize, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { depuisUtf8, stockageChiffre, versUtf8 } from './chiffre';
import type { Plateforme } from './plateforme.types';
import { CleIndisponible, type Chiffreur, type LigneStockee, type StockageHorsLigne } from './types';

/**
 * iOS / Android (lot M3) : SQLite + chiffrement applicatif.
 *
 * Choix (voir README § Hors ligne) :
 * - SQLCipher (`expo-sqlite` avec `useSQLCipher`) demande un build natif : il ne marche PAS dans Expo Go.
 * - Donc : base SQLite ordinaire, et chaque valeur sensible (contenu des événements : Kayé, code, position ;
 *   cache : visites, fiches, compte) est chiffrée par l'app en AES-256-GCM (`expo-crypto`).
 * - La clé (256 bits, aléatoire) est dans `expo-secure-store` (Keychain / Keystore),
 *   lisible après le premier déverrouillage, jamais sauvegardée hors de l'appareil.
 * - Déconnexion : lignes effacées ET clé effacée. Un reste éventuel dans le fichier devient illisible.
 * - V1c (M4) : une erreur de lecture de la clé n'efface RIEN (`CleIndisponible`). Une clé neuve est créée
 *   seulement si aucune donnée chiffrée n'existe (repère `cle` dans la table `meta`), et jamais par-dessus une clé existante.
 */

const NOM_BASE = 'koudmen-hors-ligne.db';
const CLE_SECURE_STORE = 'koudmen.cleHorsLigne';
const OPTIONS_CLE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
/** Préfixe de version du format chiffré (iv 12 o + texte + tag 16 o, en base64). */
const VERSION = 'v1:';

function stockageSqlite(): StockageHorsLigne {
  let ouverture: Promise<SQLite.SQLiteDatabase> | null = null;
  const base = () => {
    if (!ouverture) {
      ouverture = (async () => {
        const db = await SQLite.openDatabaseAsync(NOM_BASE);
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA secure_delete = ON;
          CREATE TABLE IF NOT EXISTS cache (cle TEXT PRIMARY KEY NOT NULL, valeur TEXT NOT NULL, enregistre_a INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS file (
            id TEXT PRIMARY KEY NOT NULL, seq INTEGER NOT NULL, type TEXT NOT NULL, visite_id TEXT,
            statut TEXT NOT NULL, tentatives INTEGER NOT NULL, contenu TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY NOT NULL, valeur TEXT NOT NULL);
        `);
        return db;
      })().catch((e) => {
        ouverture = null;
        throw e;
      });
    }
    return ouverture;
  };

  type Rang = { id: string; seq: number; type: string; visite_id: string | null; statut: string; tentatives: number; contenu: string };

  return {
    async lireCache(cle) {
      const r = await (await base()).getFirstAsync<{ valeur: string; enregistre_a: number }>('SELECT valeur, enregistre_a FROM cache WHERE cle = ?', cle);
      return r ? { valeur: r.valeur, enregistreA: r.enregistre_a } : null;
    },
    async ecrireCache(cle, e) {
      await (await base()).runAsync('INSERT OR REPLACE INTO cache (cle, valeur, enregistre_a) VALUES (?, ?, ?)', cle, e.valeur, e.enregistreA);
    },
    async effacerCache(cle) {
      await (await base()).runAsync('DELETE FROM cache WHERE cle = ?', cle);
    },
    async listerLignes() {
      const rangs = await (await base()).getAllAsync<Rang>('SELECT * FROM file ORDER BY seq ASC');
      return rangs.map(
        (r): LigneStockee => ({
          id: r.id,
          seq: r.seq,
          type: r.type,
          visiteId: r.visite_id,
          statut: r.statut === 'REFUSE' ? 'REFUSE' : 'EN_ATTENTE',
          tentatives: r.tentatives,
          contenu: r.contenu,
        }),
      );
    },
    async ecrireLigne(l) {
      await (await base()).runAsync(
        'INSERT OR REPLACE INTO file (id, seq, type, visite_id, statut, tentatives, contenu) VALUES (?, ?, ?, ?, ?, ?, ?)',
        l.id,
        l.seq,
        l.type,
        l.visiteId,
        l.statut,
        l.tentatives,
        l.contenu,
      );
    },
    async supprimerLigne(id) {
      await (await base()).runAsync('DELETE FROM file WHERE id = ?', id);
    },
    async lireMeta(cle) {
      const r = await (await base()).getFirstAsync<{ valeur: string }>('SELECT valeur FROM meta WHERE cle = ?', cle);
      return r?.valeur ?? null;
    },
    async ecrireMeta(cle, v) {
      await (await base()).runAsync('INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)', cle, v);
    },
    async toutEffacer() {
      const db = await base();
      await db.execAsync('DELETE FROM cache; DELETE FROM file; DELETE FROM meta; PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
    },
  };
}

/** Repère en clair dans `meta` : « une clé a été créée et des données ont pu être chiffrées avec elle ». */
const META_CLE = 'cle';

/** Lit la clé gardée. Une erreur du stockage sûr devient `CleIndisponible` (passagère, rien n'est effacé). */
async function lireCleGardee(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CLE_SECURE_STORE, OPTIONS_CLE);
  } catch {
    throw new CleIndisponible();
  }
}

async function importer(texte: string): Promise<AESEncryptionKey> {
  try {
    return await AESEncryptionKey.import(texte, 'base64');
  } catch {
    throw new CleIndisponible('Clé de chiffrement illisible.');
  }
}

function chiffreurAes(base: StockageHorsLigne): Chiffreur & { oublierCle(): Promise<void> } {
  let cle: Promise<AESEncryptionKey> | null = null;

  /**
   * `creer` : seulement pour CHIFFRER (écriture). Lire une donnée n'a jamais besoin d'une clé neuve.
   * Règles : 1. clé gardée → elle sert ; 2. erreur de lecture → `CleIndisponible` ;
   * 3. clé absente MAIS repère présent (des données chiffrées existent) → `CleIndisponible` (pas de clé neuve) ;
   * 4. clé absente, sans repère → clé neuve, écrite seulement si aucune clé n'est apparue entre-temps.
   */
  const lireCle = (creer: boolean) => {
    if (!cle) {
      const p = (async () => {
        const gardee = await lireCleGardee();
        if (gardee) {
          const k = await importer(gardee);
          // Installations d'avant V1c : poser le repère une fois.
          if (!(await base.lireMeta(META_CLE).catch(() => null))) await base.ecrireMeta(META_CLE, '1').catch(() => undefined);
          return k;
        }
        const repere = await base.lireMeta(META_CLE).catch(() => {
          throw new CleIndisponible();
        });
        if (repere) throw new CleIndisponible('Clé de chiffrement absente alors que des données chiffrées existent.');
        if (!creer) throw new CleIndisponible('Pas encore de clé de chiffrement.');
        const neuve = await AESEncryptionKey.generate(AESKeySize.AES256);
        // Jamais par-dessus une clé existante : on relit juste avant d'écrire.
        const entreTemps = await lireCleGardee();
        if (entreTemps) return importer(entreTemps);
        await SecureStore.setItemAsync(CLE_SECURE_STORE, await neuve.encoded('base64'), OPTIONS_CLE);
        await base.ecrireMeta(META_CLE, '1');
        return neuve;
      })();
      cle = p;
      p.catch(() => {
        if (cle === p) cle = null;
      });
    }
    return cle;
  };

  return {
    async chiffrer(texte) {
      const scelle = await aesEncryptAsync(versUtf8(texte), await lireCle(true));
      return VERSION + (await scelle.combined('base64'));
    },
    async dechiffrer(texteChiffre) {
      if (!texteChiffre.startsWith(VERSION)) throw new Error('Format chiffré inconnu');
      const scelle = AESSealedData.fromCombined(texteChiffre.slice(VERSION.length));
      const octets = await aesDecryptAsync(scelle, await lireCle(false));
      return depuisUtf8(octets);
    },
    async oublierCle() {
      cle = null;
      await SecureStore.deleteItemAsync(CLE_SECURE_STORE, OPTIONS_CLE);
    },
  };
}

export function creerPlateforme(): Plateforme {
  const sqlite = stockageSqlite();
  const chiffreur = chiffreurAes(sqlite);
  return {
    stockage: stockageChiffre(sqlite, chiffreur),
    oublierCle: () => chiffreur.oublierCle(),
    description: 'SQLite, contenus chiffrés AES-256-GCM (clé dans le stockage sûr)',
  };
}
