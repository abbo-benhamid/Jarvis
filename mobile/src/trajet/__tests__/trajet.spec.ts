import { expect, test } from '@playwright/test';
import { ApiError, type EtatTrajetServeur } from '../../api/types';
import type { PositionTrajet } from '../../api/client';
import type { LectureTrajet } from '../../native/types';
import { creerGestionnaireTrajet, positionAEnvoyer, type Horloge } from '../gestionnaire';

/**
 * L1-C : gestionnaire du trajet partagé (module pur, sans appareil).
 * Règles : 1 envoi / 30 s au plus, seule la DERNIÈRE lecture compte, pas de file hors ligne,
 * position arrondie (~100 m), arrêt à 60 min, à moins de 150 m d'un domicile précis, au 409 du serveur.
 */

/** Horloge manuelle : `avancer(ms)` déclenche les minuteries échues. */
function horlogeManuelle(): Horloge & { avancer(ms: number): Promise<void> } {
  let t = Date.parse('2026-10-07T14:00:00.000Z');
  let suivant = 0;
  const minuteries = new Map<number, { a: number; fn: () => void }>();
  return {
    maintenant: () => t,
    programmer(fn, ms) {
      const id = ++suivant;
      minuteries.set(id, { a: t + ms, fn });
      return () => minuteries.delete(id);
    },
    async avancer(ms) {
      const fin = t + ms;
      for (;;) {
        const prochaine = [...minuteries.entries()].filter(([, m]) => m.a <= fin).sort((a, b) => a[1].a - b[1].a)[0];
        if (!prochaine) break;
        minuteries.delete(prochaine[0]);
        t = prochaine[1].a;
        prochaine[1].fn();
        await vider();
      }
      t = fin;
      await vider();
    },
  };
}

const vider = () => new Promise((r) => setTimeout(r, 0));

const DOMICILE = { latitude: 14.6085, longitude: -61.068, approximatif: false };
/** ≈ 1,6 km du domicile. */
const LOIN = { latitude: 14.5985, longitude: -61.0775 };

function monter(opts: { domicile?: typeof DOMICILE | null; reseau?: () => Error | null; expireDansMin?: number } = {}) {
  const h = horlogeManuelle();
  const envoyes: PositionTrajet[] = [];
  const appels: string[] = [];
  let surLecture: ((l: LectureTrajet) => void) | null = null;
  let suivisArretes = 0;
  const api = {
    async demarrerTrajet(id: string): Promise<EtatTrajetServeur> {
      appels.push(`DEMARRER ${id}`);
      return {
        etat: 'EN_COURS',
        expireA: new Date(h.maintenant() + (opts.expireDansMin ?? 60) * 60_000).toISOString(),
        domicile: opts.domicile === undefined ? DOMICILE : opts.domicile,
      };
    },
    async arreterTrajet(id: string): Promise<EtatTrajetServeur> {
      appels.push(`ARRETER ${id}`);
      return { etat: 'ARRETE', expireA: null, domicile: null };
    },
    async envoyerPosition(_id: string, p: PositionTrajet) {
      const e = opts.reseau?.();
      if (e) throw e;
      envoyes.push(p);
    },
  };
  const g = creerGestionnaireTrajet({
    api,
    horloge: h,
    ecartEnvoiMs: () => 30_000,
    suivre: async (cb) => {
      surLecture = cb;
      return { arreter: () => (suivisArretes += 1) };
    },
  });
  const lire = (p: { latitude: number; longitude: number }, precisionMetres = 12, simulee = false) =>
    surLecture?.({ ...p, precisionMetres, simulee, lueA: h.maintenant() });
  return { g, h, envoyes, appels, lire, suivisArretes: () => suivisArretes };
}

test('envoi : arrondi à ~100 m, précision annoncée ≥ 100 m, simulee transmis', () => {
  const p = positionAEnvoyer({ latitude: 14.598512, longitude: -61.077549, precisionMetres: 8, simulee: true, lueA: 0 });
  expect(p).toEqual({ latitude: 14.599, longitude: -61.078, precisionMetres: 100, survenuA: '1970-01-01T00:00:00.000Z', simulee: true });
});

test('démarrage : DEMARRER puis suivi ; une position au plus toutes les 30 s, la DERNIÈRE', async () => {
  const m = monter();
  await m.g.demarrer('vis_1', 'Léonie', null);
  expect(m.appels).toEqual(['DEMARRER vis_1']);
  expect(m.g.etat().statut).toBe('en_cours');

  m.lire(LOIN);
  await vider();
  expect(m.envoyes).toHaveLength(1);

  // 3 lectures en 20 s : aucune ne part avant les 30 s, puis seule la dernière part.
  await m.h.avancer(5_000);
  m.lire({ latitude: 14.6, longitude: -61.076 });
  await m.h.avancer(5_000);
  m.lire({ latitude: 14.601, longitude: -61.075 });
  await m.h.avancer(10_000);
  m.lire({ latitude: 14.602, longitude: -61.074 });
  expect(m.envoyes).toHaveLength(1);
  await m.h.avancer(10_000);
  expect(m.envoyes).toHaveLength(2);
  expect(m.envoyes[1]).toMatchObject({ latitude: 14.602, longitude: -61.074 });
});

test('hors ligne : la position perdue n’est PAS renvoyée (pas de file) ; la suivante part', async () => {
  let coupe = true;
  const m = monter({ reseau: () => (coupe ? new ApiError('RESEAU', 'Pas de réseau') : null) });
  await m.g.demarrer('vis_1', 'Léonie', null);
  m.lire(LOIN);
  await vider();
  expect(m.envoyes).toHaveLength(0);
  const e = m.g.etat();
  expect(e.statut === 'en_cours' && e.reseau).toBe('hors_ligne');

  coupe = false;
  await m.h.avancer(31_000);
  // Rien n'est renvoyé tout seul : aucune nouvelle lecture.
  expect(m.envoyes).toHaveLength(0);
  m.lire({ latitude: 14.6, longitude: -61.076 });
  await vider();
  expect(m.envoyes).toHaveLength(1);
  expect(m.envoyes[0]).toMatchObject({ latitude: 14.6 });
  const e2 = m.g.etat();
  expect(e2.statut === 'en_cours' && e2.reseau).toBe('ok');
});

test('arrêt automatique à moins de 150 m d’un domicile PRÉCIS (ARRETER envoyé)', async () => {
  const m = monter();
  await m.g.demarrer('vis_1', 'Léonie', null);
  m.lire({ latitude: 14.6092, longitude: -61.0679 }); // ≈ 80 m
  await vider();
  const e = m.g.etat();
  expect(e.statut).toBe('inactif');
  expect(e.statut === 'inactif' && e.fin?.raison).toBe('arrivee');
  expect(m.suivisArretes()).toBe(1);
  expect(m.appels).toContain('ARRETER vis_1');
  expect(m.envoyes).toHaveLength(0);
});

test('domicile APPROXIMATIF (centre de commune) : pas d’arrêt à 150 m', async () => {
  const m = monter({ domicile: { ...DOMICILE, approximatif: true } });
  await m.g.demarrer('vis_1', 'Léonie', null);
  m.lire({ latitude: 14.6092, longitude: -61.0679 });
  await vider();
  expect(m.g.etat().statut).toBe('en_cours');
});

test('arrêt automatique à 60 min, même si le serveur annonce plus tard', async () => {
  const m = monter({ expireDansMin: 90 });
  await m.g.demarrer('vis_1', 'Léonie', null);
  await m.h.avancer(59 * 60_000);
  expect(m.g.etat().statut).toBe('en_cours');
  await m.h.avancer(61_000);
  const e = m.g.etat();
  expect(e.statut === 'inactif' && e.fin?.raison).toBe('duree');
  expect(m.appels).toContain('ARRETER vis_1');
});

test('409 du serveur : arrêt local, sans ARRETER ; check-in : arrêt sans ARRETER', async () => {
  const m = monter({ reseau: () => new ApiError('CONFLIT', 'Fini', 409) });
  await m.g.demarrer('vis_1', 'Léonie', null);
  m.lire(LOIN);
  await vider();
  const e = m.g.etat();
  expect(e.statut === 'inactif' && e.fin?.raison).toBe('serveur');
  expect(m.appels).toEqual(['DEMARRER vis_1']);

  const m2 = monter();
  await m2.g.demarrer('vis_2', 'Alphonse', null);
  m2.g.arreter('check_in');
  expect(m2.appels).toEqual(['DEMARRER vis_2']);
  expect(m2.suivisArretes()).toBe(1);
});

test('arrêt manuel : suivi coupé, dernière position oubliée, plus aucun envoi', async () => {
  const m = monter();
  await m.g.demarrer('vis_1', 'Léonie', null);
  m.lire(LOIN);
  await vider();
  m.lire({ latitude: 14.6, longitude: -61.076 }); // en attente des 30 s
  m.g.arreter();
  await m.h.avancer(60_000);
  expect(m.envoyes).toHaveLength(1);
  expect(m.appels).toEqual(['DEMARRER vis_1', 'ARRETER vis_1']);
  const e = m.g.etat();
  expect(e.statut).toBe('inactif');
  expect(JSON.stringify(e)).not.toContain('14.6');
});

test('permission refusée : retour à inactif, ARRETER envoyé, erreur remontée', async () => {
  const appels: string[] = [];
  const g = creerGestionnaireTrajet({
    api: {
      demarrerTrajet: async () => {
        appels.push('DEMARRER');
        return { etat: 'EN_COURS', expireA: null, domicile: null };
      },
      arreterTrajet: async () => {
        appels.push('ARRETER');
        return { etat: 'ARRETE', expireA: null, domicile: null };
      },
      envoyerPosition: async () => undefined,
    },
    ecartEnvoiMs: () => 30_000,
    suivre: async () => {
      throw new ApiError('POSITION_INDISPONIBLE', 'Refus');
    },
  });
  await expect(g.demarrer('vis_1', 'Léonie', null)).rejects.toThrow('Refus');
  expect(g.etat().statut).toBe('inactif');
  await vider();
  expect(appels).toEqual(['DEMARRER', 'ARRETER']);
});
