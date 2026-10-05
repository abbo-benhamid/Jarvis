import type { Evenement, MotifRefus, ResultatEvenement } from '../../contracts';
import { ApiError } from '../../api/types';
import type { Transport } from '../file';
import type { Planifier } from '../types';

/** WebCrypto global (Node ≥ 20 et navigateurs) : pas de dépendance à @types/node. */
const randomUUID = () => globalThis.crypto.randomUUID();

/** Aides des tests unitaires du lot M3 (sans navigateur, sans Expo). */

export const KAYE = { humeur: 4, appetit: 'BON' as const, activites: ['Dominos'], note: 'Léonie a gagné deux fois aux dominos.', aSurveiller: false };

let horloge = Date.parse('2026-10-05T14:00:00.000Z');
const survenu = () => new Date((horloge += 1000)).toISOString();

export const ev = {
  checkIn: (visiteId = 'vis_1'): Evenement => ({ type: 'CHECK_IN', visiteId, codeDomicile: 'KDM482', clientEventId: randomUUID(), survenuA: survenu() }),
  checkOut: (visiteId = 'vis_1'): Evenement => ({ type: 'CHECK_OUT', visiteId, clientEventId: randomUUID(), survenuA: survenu() }),
  brouillon: (visiteId = 'vis_1', note = 'Brouillon'): Evenement => ({ type: 'KAYE_BROUILLON', visiteId, kaye: { note }, clientEventId: randomUUID(), survenuA: survenu() }),
  kaye: (visiteId = 'vis_1', note = KAYE.note): Evenement => ({ type: 'KAYE_PUBLICATION', visiteId, kaye: { ...KAYE, note }, clientEventId: randomUUID(), survenuA: survenu() }),
  sos: (visiteId?: string): Evenement => ({ type: 'SOS', ...(visiteId ? { visiteId } : {}), clientEventId: randomUUID(), survenuA: survenu() }),
};

/**
 * Serveur factice qui suit api-v1 § 9.2 : idempotence par clientEventId (DOUBLON + statut d'origine),
 * refus métier gardé. `reseau = false` : chaque envoi lève RESEAU.
 */
export function serveurFactice() {
  /** Toutes les requêtes reçues (renvois compris). */
  const recus: Evenement[] = [];
  /** Premier traitement de chaque identifiant. */
  const traites = new Map<string, ResultatEvenement>();
  const s = {
    reseau: true,
    /** Le serveur traite l'événement, puis la réponse se perd (coupure). Une fois. */
    perdreProchaineReponse: false,
    /** Le prochain envoi reçoit DOUBLON / EN_COURS (envoi parallèle encore traité). Une fois. */
    enCoursUneFois: false,
    /** Erreur HTTP levée au prochain envoi (session perdue, 5xx…). Une fois. */
    erreurUneFois: null as ApiError | null,
    refuser: null as null | ((e: Evenement) => MotifRefus | null),
    recus,
    traites,
    /** Types acceptés, dans l'ordre du premier traitement. */
    acceptes: () => [...traites.values()].filter((r) => r.statut === 'ACCEPTE').map((r) => r.type),
    transport: (async (e) => {
      await Promise.resolve();
      if (!s.reseau) throw new ApiError('RESEAU', 'Pas de connexion au service.');
      if (s.erreurUneFois) {
        const err = s.erreurUneFois;
        s.erreurUneFois = null;
        throw err;
      }
      recus.push(e);
      if (s.enCoursUneFois) {
        s.enCoursUneFois = false;
        return { clientEventId: e.clientEventId, type: e.type, statut: 'DOUBLON', statutOrigine: 'EN_COURS', horlogeSuspecte: false };
      }
      let r: ResultatEvenement;
      const deja = traites.get(e.clientEventId);
      if (deja) {
        r = { ...deja, statut: 'DOUBLON', statutOrigine: deja.statut === 'REFUSE' ? 'REFUSE' : 'ACCEPTE' };
      } else {
        const motif = s.refuser?.(e) ?? null;
        r = motif
          ? { clientEventId: e.clientEventId, type: e.type, statut: 'REFUSE', motif, message: `Refusé : ${motif}`, horlogeSuspecte: false }
          : { clientEventId: e.clientEventId, type: e.type, statut: 'ACCEPTE', horlogeSuspecte: false, ...(e.type === 'SOS' ? { consigne: 'Appelez le 15 ou le 112.' } : {}) };
        traites.set(e.clientEventId, r);
      }
      if (s.perdreProchaineReponse) {
        s.perdreProchaineReponse = false;
        throw new ApiError('RESEAU', 'Réponse perdue.');
      }
      return r;
    }) as Transport,
  };
  return s;
}

/** Minuteurs manuels : on voit les délais programmés et on les déclenche à la main. */
export function minuteursManuels() {
  const liste: { fn: () => void; ms: number; actif: boolean }[] = [];
  const planifier: Planifier = (fn, ms) => {
    const m = { fn, ms, actif: true };
    liste.push(m);
    return () => {
      m.actif = false;
    };
  };
  return {
    planifier,
    actifs: () => liste.filter((m) => m.actif),
    /** Déclenche les minuteurs actifs. */
    declencher() {
      for (const m of liste.filter((x) => x.actif)) {
        m.actif = false;
        m.fn();
      }
    },
  };
}

/** Laisse finir les promesses en cours. */
export async function laisserFinir(tours = 20) {
  for (let i = 0; i < tours; i++) await new Promise<void>((r) => setTimeout(r, 0));
}

/** Chiffreur de test RÉEL : AES-256-GCM de Node (WebCrypto), même format « v1:base64(iv|texte|tag) ». */
export async function chiffreurWebCrypto() {
  const webcrypto = globalThis.crypto;
  const { versUtf8, depuisUtf8 } = await import('../chiffre');
  const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o));
  const deB64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  const cle = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return {
    async chiffrer(texte: string) {
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const c = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, versUtf8(texte) as Uint8Array<ArrayBuffer>));
      const tout = new Uint8Array(iv.length + c.length);
      tout.set(iv);
      tout.set(c, iv.length);
      return 'v1:' + b64(tout);
    },
    async dechiffrer(t: string) {
      const brut = deB64(t.slice(3));
      const clair = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: brut.subarray(0, 12) }, cle, brut.subarray(12));
      return depuisUtf8(new Uint8Array(clair));
    },
  };
}
