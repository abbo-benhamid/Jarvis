import { expect, test } from '@playwright/test';
import { routeDepuisDonnees } from '../cible';
import { creerPush, type DepsPush } from '../push';
import type { EtatPermission, MemoirePush, PushNatif } from '../types';

/**
 * Tests unitaires du lot N1 (modules purs, sans téléphone ni serveur) :
 * `npm run test:push`.
 */

function faux(opts: { permission?: EtatPermission; accepteSysteme?: boolean; confirme?: boolean; jeton?: string | null; disponible?: boolean } = {}) {
  const journal: string[] = [];
  let permission: EtatPermission = opts.permission ?? 'a_demander';
  const valeurs = new Map<string, string>();
  const natif: PushNatif = {
    disponible: opts.disponible ?? true,
    plateforme: opts.disponible === false ? null : 'ANDROID',
    configurer: async () => undefined,
    permission: async () => permission,
    demanderPermission: async () => {
      journal.push('systeme');
      permission = opts.accepteSysteme ? 'accordee' : 'refusee';
      return !!opts.accepteSysteme;
    },
    jeton: async () => (opts.jeton === undefined ? 'ExponentPushToken[aaaaaaaaaaaa]' : opts.jeton),
    ecouterToucher: () => () => undefined,
    toucherAuDemarrage: async () => null,
  };
  const memoire: MemoirePush = {
    lire: async (c) => valeurs.get(c) ?? null,
    ecrire: async (c, v) => {
      valeurs.set(c, v);
    },
    effacer: async (c) => {
      valeurs.delete(c);
    },
  };
  const api: DepsPush['api'] = {
    enregistrerAppareil: async (jeton, plateforme) => {
      journal.push(`enregistrer:${jeton}:${plateforme}`);
      return { id: 'app1' };
    },
    retirerAppareil: async (id) => {
      journal.push(`retirer:${id}`);
    },
  };
  const confirmer = async () => {
    journal.push('invite');
    return opts.confirme ?? true;
  };
  return { push: creerPush({ api, natif, memoire, confirmer }), journal, valeurs };
}

test.describe('push : moment de la demande', () => {
  test('après une action : invitation Koudmen, puis fenêtre du système, puis enregistrement', async () => {
    const f = faux({ accepteSysteme: true });
    expect(await f.push.proposerApresAction()).toBe(true);
    expect(f.journal).toEqual(['invite', 'systeme', 'enregistrer:ExponentPushToken[aaaaaaaaaaaa]:ANDROID']);
    expect(f.valeurs.get('appareil')).toBe('app1');
  });

  test('« Plus tard » : pas de fenêtre du système, et l’invitation ne revient pas', async () => {
    const f = faux({ confirme: false });
    expect(await f.push.proposerApresAction()).toBe(false);
    expect(await f.push.proposerApresAction()).toBe(false);
    expect(f.journal).toEqual(['invite']);
  });

  test('refus du système : jamais redemandé', async () => {
    const f = faux({ permission: 'refusee' });
    expect(await f.push.proposerApresAction()).toBe(false);
    expect(f.journal).toEqual([]);
  });

  test('permission déjà accordée : enregistrement direct, sans invitation', async () => {
    const f = faux({ permission: 'accordee' });
    expect(await f.push.proposerApresAction()).toBe(true);
    expect(f.journal).toEqual(['enregistrer:ExponentPushToken[aaaaaaaaaaaa]:ANDROID']);
  });

  test('web : rien n’est demandé', async () => {
    const f = faux({ disponible: false });
    expect(await f.push.proposerApresAction()).toBe(false);
    expect(await f.push.enregistrerSiAccorde()).toBe('indisponible');
    expect(f.journal).toEqual([]);
  });

  test('ouverture de l’app : enregistre seulement si la permission existe ; sans jeton (projet EAS absent) : rien', async () => {
    expect(await faux().push.enregistrerSiAccorde()).toBe('sans_permission');
    expect(await faux({ permission: 'accordee', jeton: null }).push.enregistrerSiAccorde()).toBe('sans_jeton');
  });
});

test.describe('push : déconnexion', () => {
  test('retire l’appareil enregistré, puis oublie son id', async () => {
    const f = faux({ permission: 'accordee' });
    await f.push.enregistrerSiAccorde();
    await f.push.retirer();
    await f.push.retirer();
    expect(f.journal.filter((x) => x.startsWith('retirer'))).toEqual(['retirer:app1']);
    expect(f.valeurs.has('appareil')).toBe(false);
  });
});

test.describe('push : écran ouvert au toucher', () => {
  test('propositions, visite, Kayé, liste', () => {
    expect(routeDepuisDonnees({ ecran: 'propositions', lien: '/accompagnant/propositions' })).toBe('/propositions');
    expect(routeDepuisDonnees({ ecran: 'visite', visiteId: 'cmv1', lien: '/famille/kaye' })).toEqual({ pathname: '/visite/[id]', params: { id: 'cmv1' } });
    expect(routeDepuisDonnees({ ecran: 'kaye', visiteId: 'cmv1', lien: '/famille/kaye' })).toEqual({ pathname: '/visite/[id]', params: { id: 'cmv1' } });
    expect(routeDepuisDonnees({ ecran: 'kaye', lien: '/famille/kaye' })).toBe('/visites');
    expect(routeDepuisDonnees({ ecran: 'visites', lien: '/' })).toBe('/visites');
  });

  test('données hors contrat : rien ne s’ouvre', () => {
    for (const d of [null, {}, { ecran: 'admin', lien: '/' }, { ecran: 'visite', visiteId: '../x', lien: '/' }, { ecran: 'visite', lien: 'https://ailleurs' }]) {
      expect(routeDepuisDonnees(d)).toBeNull();
    }
  });
});
