import { expect, test } from '@playwright/test';
import type { Evenement } from '../../contracts';
import { ApiError } from '../../api/types';
import { classerErreur, creerFile, MAX_EN_COURS, type Transport } from '../file';
import { stockageChiffre } from '../chiffre';
import { stockageMemoire } from '../memoire';
import { CleIndisponible } from '../types';
import { chiffreurWebCrypto, ev, laisserFinir, minuteursManuels, serveurFactice } from './aides';

/**
 * Sprint V1c (revue de code V1) : la file ne se bloque jamais à vie et ne perd rien en silence.
 * M1 (EN_COURS répété), M3 (correction pendant l'envoi), M4 (stockage illisible), M6 (réponse hors contrat),
 * M9 (Kayé refusé corrigeable), m8 (check-ins regroupés), m10 (écriture impossible).
 */

function monter(options: { reseau?: boolean } = {}) {
  const stockage = stockageMemoire();
  const serveur = serveurFactice();
  serveur.reseau = options.reseau ?? true;
  const minuteurs = minuteursManuels();
  const file = creerFile({ stockage, transport: serveur.transport, planifier: minuteurs.planifier, alea: () => 0 });
  return { stockage, serveur, minuteurs, file };
}

/** Transport qui garde le premier envoi « en vol » jusqu'à `liberer()`. */
function transportRetenu(suite: Transport, issuePremier: 'normal' | 'reseau' = 'normal') {
  let liberer: (() => void) | null = null;
  let premier = true;
  const transport: Transport = async (e) => {
    if (premier) {
      premier = false;
      await new Promise<void>((r) => (liberer = r));
      if (issuePremier === 'reseau') throw new ApiError('RESEAU', 'coupure');
    }
    return suite(e);
  };
  return { transport, liberer: () => liberer?.(), enVol: () => liberer !== null };
}

const noteDe = (e: Evenement | undefined) => (e && (e.type === 'KAYE_PUBLICATION' || e.type === 'KAYE_BROUILLON') ? e.kaye.note : undefined);

test.describe('M1 : DOUBLON / EN_COURS répété', () => {
  test('attente progressive, puis refus « à vérifier » visible ; la file continue ; le texte revient', async () => {
    const serveur = serveurFactice();
    const minuteurs = minuteursManuels();
    // Réservation orpheline côté serveur pour le Kayé seulement : chaque renvoi reçoit DOUBLON / EN_COURS.
    const transport: Transport = async (e) =>
      e.type === 'KAYE_PUBLICATION'
        ? { clientEventId: e.clientEventId, type: e.type, statut: 'DOUBLON', statutOrigine: 'EN_COURS', horlogeSuspecte: false }
        : serveur.transport(e);
    const file = creerFile({ stockage: stockageMemoire(), transport, planifier: minuteurs.planifier, alea: () => 0 });
    const k = ev.kaye('vis_1', 'Texte du Kayé');
    await expect(file.soumettre(k)).rejects.toMatchObject({ code: 'EN_ATTENTE' });
    await file.soumettre(ev.checkOut('vis_2')).catch(() => undefined);

    const delais: number[] = [];
    for (let i = 0; i < MAX_EN_COURS && minuteurs.actifs().length > 0; i++) {
      delais.push(minuteurs.actifs()[0]?.ms ?? -1);
      minuteurs.declencher();
      await laisserFinir();
    }
    // Attente progressive (l'essai forcé par le 2e envoi compte aussi) : chaque délai double. Puis plus aucun minuteur.
    expect(delais.slice(0, 4)).toEqual([4000, 8000, 16000, 32000]);
    expect(minuteurs.actifs()).toHaveLength(0);
    expect(file.etat().refus).toEqual([
      expect.objectContaining({ id: k.clientEventId, type: 'KAYE_PUBLICATION', code: 'A_VERIFIER', message: expect.stringContaining('vérifier') }),
    ]);
    expect(serveur.acceptes()).toEqual(['CHECK_OUT']);
    expect(file.etat()).toMatchObject({ enAttente: 0, blocage: null });
    expect(await file.kayeEnAttente('vis_1')).toMatchObject({ note: 'Texte du Kayé' });
  });

  test('un EN_COURS isolé reste une attente courte (pas de refus)', async () => {
    const { file, serveur, minuteurs } = monter();
    serveur.enCoursUneFois = true;
    await file.soumettre(ev.checkOut()).catch(() => undefined);
    minuteurs.declencher();
    await laisserFinir();
    expect(file.etat()).toMatchObject({ enAttente: 0, refus: [] });
  });
});

test.describe('M3 : correction pendant l’envoi', () => {
  test('l’ancien est en vol puis accepté : la correction part ENSUITE avec son propre identifiant', async () => {
    const serveur = serveurFactice();
    const r = transportRetenu(serveur.transport);
    const file = creerFile({ stockage: stockageMemoire(), transport: r.transport, planifier: minuteursManuels().planifier, alea: () => 0 });
    const premier = ev.kaye('vis_1', 'Premier texte');
    const p1 = file.soumettre(premier);
    await laisserFinir();
    expect(r.enVol()).toBe(true);

    const corrige = ev.kaye('vis_1', 'Texte corrigé');
    const p2 = file.soumettre(corrige);
    await laisserFinir();
    r.liberer();
    await expect(p1).resolves.toMatchObject({ statut: 'ACCEPTE' });
    await p2.catch(() => undefined);
    await laisserFinir();
    expect(serveur.recus.map((e) => e.clientEventId)).toEqual([premier.clientEventId, corrige.clientEventId]);
    expect(noteDe(serveur.recus[1])).toBe('Texte corrigé');
  });

  test('l’ancien est en vol puis échoue (réseau) : seul le texte corrigé est gardé et renvoyé', async () => {
    const serveur = serveurFactice();
    const stockage = stockageMemoire();
    const minuteurs = minuteursManuels();
    const r = transportRetenu(serveur.transport, 'reseau');
    const file = creerFile({ stockage, transport: r.transport, planifier: minuteurs.planifier, alea: () => 0 });
    const p1 = file.soumettre(ev.kaye('vis_1', 'Premier texte'));
    await laisserFinir();
    const corrige = ev.kaye('vis_1', 'Texte corrigé');
    const p2 = file.soumettre(corrige);
    await laisserFinir();
    r.liberer();
    await p1.catch(() => undefined);
    await p2.catch(() => undefined);
    await laisserFinir();
    // L'ancien n'est jamais réécrit sur le téléphone ; la correction part à la passe suivante.
    expect(serveur.recus.map((e) => e.clientEventId)).toEqual([corrige.clientEventId]);
    expect(await stockage.listerLignes()).toEqual([]);
    expect(minuteurs.actifs().length).toBeLessThanOrEqual(1);
    expect(file.etat().enAttente).toBe(0);
  });
});

test.describe('M6 : réponse hors contrat', () => {
  test('REPONSE_INVALIDE = erreur définitive : refus affiché, la tête de file est libérée, aucun minuteur', async () => {
    expect(classerErreur(new ApiError('REPONSE_INVALIDE', 'x', 200))).toBe('definitif');
    const { file, serveur, minuteurs } = monter();
    serveur.erreurUneFois = new ApiError('REPONSE_INVALIDE', 'L’app doit être mise à jour.', 200);
    await expect(file.soumettre(ev.checkIn())).rejects.toMatchObject({ code: 'REPONSE_INVALIDE' });
    await file.soumettre(ev.checkOut());
    expect(minuteurs.actifs()).toHaveLength(0);
    expect(file.etat()).toMatchObject({ enAttente: 0, refus: [expect.objectContaining({ code: 'REPONSE_INVALIDE' })] });
  });
});

test.describe('m8 et M9', () => {
  test('m8 : check-ins répétés hors ligne → une seule ligne, dernier code ET position gardés', async () => {
    const { file, serveur } = monter({ reseau: false });
    const avecCode = (code: string): Evenement => ({ ...(ev.checkIn() as Extract<Evenement, { type: 'CHECK_IN' }>), codeDomicile: code });
    const avecPosition = (): Evenement => {
      const { codeDomicile: _c, ...e } = ev.checkIn() as Extract<Evenement, { type: 'CHECK_IN' }>;
      return { ...e, position: { latitude: 14.6, longitude: -61, consentement: true } };
    };
    await file.soumettre(avecCode('MAUVAIS')).catch(() => undefined);
    await file.soumettre(avecPosition()).catch(() => undefined);
    await file.soumettre(avecCode('LKW7Q3')).catch(() => undefined);
    expect(file.etat().enAttente).toBe(1);
    serveur.reseau = true;
    await file.synchroniser({ forcer: true });
    expect(serveur.recus).toHaveLength(1);
    expect(serveur.recus[0]).toMatchObject({ type: 'CHECK_IN', codeDomicile: 'LKW7Q3', position: { latitude: 14.6 } });
  });

  test('M9 : Kayé refusé mais corrigeable (INTERDIT) → le texte revient dans le formulaire, puis plus après un nouveau Kayé', async () => {
    const { file, serveur } = monter({ reseau: false });
    serveur.refuser = (e) => (e.type === 'CHECK_IN' ? 'INVALIDE' : e.type === 'KAYE_PUBLICATION' ? 'INTERDIT' : null);
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    await file.soumettre(ev.kaye('vis_1', 'Texte écrit hors ligne')).catch(() => undefined);
    serveur.reseau = true;
    await file.synchroniser({ forcer: true });
    expect(file.etat().refus.map((r) => r.code)).toEqual(['INVALIDE', 'INTERDIT']);
    expect(await file.kayeEnAttente('vis_1')).toMatchObject({ note: 'Texte écrit hors ligne' });

    serveur.refuser = null;
    await file.soumettre(ev.kaye('vis_1', 'Nouveau'));
    expect(await file.kayeEnAttente('vis_1')).toBeNull();
  });
});

test.describe('M4 et m10 : stockage', () => {
  test('lecture en échec (clé indisponible) : rien n’est effacé, seul le SOS part, puis tout repart à la relecture', async () => {
    const base = stockageMemoire();
    const k = ev.kaye();
    await base.ecrireLigne({ id: k.clientEventId, seq: 1, type: k.type, visiteId: 'vis_1', statut: 'EN_ATTENTE', tentatives: 1, contenu: JSON.stringify(k) });
    let panne = true;
    const stockage = { ...base, listerLignes: () => (panne ? Promise.reject(new Error('Keystore indisponible')) : base.listerLignes()) };
    const serveur = serveurFactice();
    const minuteurs = minuteursManuels();
    const file = creerFile({ stockage, transport: serveur.transport, planifier: minuteurs.planifier, alea: () => 0 });

    await file.soumettre(ev.sos('vis_1'));
    await laisserFinir();
    expect(serveur.recus.map((e) => e.type)).toEqual(['SOS']);
    expect(file.etat().blocage).toBe('stockage');
    expect(await base.listerLignes()).toHaveLength(1);

    panne = false;
    minuteurs.declencher();
    await laisserFinir();
    expect(serveur.recus.map((e) => e.type)).toEqual(['SOS', 'KAYE_PUBLICATION']);
    expect(file.etat()).toMatchObject({ enAttente: 0, blocage: null });
  });

  test('M4 : clé indisponible une fois → aucune ligne ni cache effacé ; donnée vraiment illisible → effacée', async () => {
    const brut = stockageMemoire();
    const vrai = await chiffreurWebCrypto();
    let panne = 1;
    const chiffreur = {
      chiffrer: vrai.chiffrer,
      async dechiffrer(t: string) {
        if (panne-- > 0) throw new CleIndisponible();
        return vrai.dechiffrer(t);
      },
    };
    const s = stockageChiffre(brut, chiffreur);
    await s.ecrireLigne({ id: 'e1', seq: 1, type: 'KAYE_PUBLICATION', visiteId: 'v1', statut: 'EN_ATTENTE', tentatives: 0, contenu: '{"note":"Elle boit peu"}' });
    await s.ecrireCache('moi', { valeur: '{}', enregistreA: 1 });

    await expect(s.listerLignes()).rejects.toBeInstanceOf(CleIndisponible);
    expect(brut.brut().lignes.size).toBe(1);
    expect((await s.listerLignes())[0]?.contenu).toContain('boit peu');

    panne = 1;
    expect(await s.lireCache('moi')).toBeNull();
    expect(brut.brut().cache.size).toBe(1);

    // Donnée abîmée avec une clé bien lue : effacée (jamais renvoyée).
    brut.brut().lignes.set('e2', { id: 'e2', seq: 2, type: 'SOS', visiteId: null, statut: 'EN_ATTENTE', tentatives: 0, contenu: 'v1:abime' });
    expect((await s.listerLignes()).map((l) => l.id)).toEqual(['e1']);
    expect(brut.brut().lignes.has('e2')).toBe(false);
  });

  test('m10 : écriture impossible → le message ne promet PAS « gardé sur ce téléphone »', async () => {
    const base = stockageMemoire();
    const stockage = { ...base, ecrireLigne: () => Promise.reject(new Error('disque plein')) };
    const serveur = serveurFactice();
    serveur.reseau = false;
    const file = creerFile({ stockage, transport: serveur.transport, planifier: minuteursManuels().planifier, alea: () => 0 });
    await expect(file.soumettre(ev.kaye())).rejects.toMatchObject({ code: 'EN_ATTENTE', message: expect.stringContaining('Gardez l’app ouverte') });
  });
});
