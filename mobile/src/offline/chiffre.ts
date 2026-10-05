import { CleIndisponible, type Chiffreur, type StockageHorsLigne } from './types';

/**
 * Enveloppe de chiffrement au repos.
 * Chiffre `contenu` (file) et `valeur` (cache) avant l'écriture ; déchiffre à la lecture.
 * - Donnée illisible avec une clé bien lue (clé changée, donnée abîmée) : SUPPRIMÉE, jamais renvoyée.
 * - Clé indisponible pour l'instant (`CleIndisponible`) : RIEN n'est supprimé. La lecture de la file échoue
 *   (la file réessaie plus tard) ; la lecture du cache renvoie « absent ».
 */
export function stockageChiffre(base: StockageHorsLigne, chiffreur: Chiffreur): StockageHorsLigne {
  return {
    async lireCache(cle) {
      const e = await base.lireCache(cle);
      if (!e) return null;
      try {
        return { valeur: await chiffreur.dechiffrer(e.valeur), enregistreA: e.enregistreA };
      } catch (err) {
        if (!(err instanceof CleIndisponible)) await base.effacerCache(cle);
        return null;
      }
    },
    async ecrireCache(cle, e) {
      await base.ecrireCache(cle, { valeur: await chiffreur.chiffrer(e.valeur), enregistreA: e.enregistreA });
    },
    effacerCache: (cle) => base.effacerCache(cle),

    async listerLignes() {
      const sortie = [];
      for (const l of await base.listerLignes()) {
        try {
          sortie.push({ ...l, contenu: await chiffreur.dechiffrer(l.contenu) });
        } catch (err) {
          // Clé indisponible : on arrête tout, sans rien effacer (la file relira plus tard).
          if (err instanceof CleIndisponible) throw err;
          await base.supprimerLigne(l.id);
        }
      }
      return sortie;
    },
    async ecrireLigne(l) {
      await base.ecrireLigne({ ...l, contenu: await chiffreur.chiffrer(l.contenu) });
    },
    supprimerLigne: (id) => base.supprimerLigne(id),

    lireMeta: (cle) => base.lireMeta(cle),
    ecrireMeta: (cle, v) => base.ecrireMeta(cle, v),
    toutEffacer: () => base.toutEffacer(),
  };
}

/** Chiffreur neutre (web en mémoire : rien n'est écrit au repos). */
export const chiffreurNeutre: Chiffreur = {
  chiffrer: async (t) => t,
  dechiffrer: async (t) => t,
};

// ─────────────── UTF-8 (sans dépendre de TextDecoder, absent de certains moteurs JS) ───────────────

export function versUtf8(texte: string): Uint8Array {
  const sortie: number[] = [];
  for (const car of texte) {
    let p = car.codePointAt(0) ?? 0xfffd;
    if (p >= 0xd800 && p <= 0xdfff) p = 0xfffd; // demi-paire isolée
    if (p < 0x80) sortie.push(p);
    else if (p < 0x800) sortie.push(0xc0 | (p >> 6), 0x80 | (p & 63));
    else if (p < 0x10000) sortie.push(0xe0 | (p >> 12), 0x80 | ((p >> 6) & 63), 0x80 | (p & 63));
    else sortie.push(0xf0 | (p >> 18), 0x80 | ((p >> 12) & 63), 0x80 | ((p >> 6) & 63), 0x80 | (p & 63));
  }
  return Uint8Array.from(sortie);
}

export function depuisUtf8(octets: Uint8Array): string {
  let s = '';
  for (let i = 0; i < octets.length; ) {
    const o = octets[i] ?? 0;
    let p: number;
    let n: number;
    if (o < 0x80) [p, n] = [o, 1];
    else if (o >> 5 === 0x6) [p, n] = [o & 31, 2];
    else if (o >> 4 === 0xe) [p, n] = [o & 15, 3];
    else if (o >> 3 === 0x1e) [p, n] = [o & 7, 4];
    else throw new Error('UTF-8 invalide');
    for (let k = 1; k < n; k++) {
      const suite = octets[i + k];
      if (suite === undefined || suite >> 6 !== 0x2) throw new Error('UTF-8 invalide');
      p = (p << 6) | (suite & 63);
    }
    s += String.fromCodePoint(p);
    i += n;
  }
  return s;
}
