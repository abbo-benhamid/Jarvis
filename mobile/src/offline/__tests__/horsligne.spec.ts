import { expect, test } from '@playwright/test';
import { stockageChiffre } from '../chiffre';
import { assemblerHorsLigne, type Surveiller } from '../horsligne';
import { stockageMemoire } from '../memoire';
import { chiffreurWebCrypto, ev, laisserFinir, serveurFactice } from './aides';

/** Assemblage (file + cache + stockage chiffré + réseau) : purge à la déconnexion, changement de compte, retour du réseau. */

const MOI = { id: 'acc_josiane', role: 'ACCOMPAGNANT' as const, prenom: 'Josiane', nom: 'Mathurin', email: 'j@exemple.test', demo: false, bacASable: false };

async function monter() {
  const brut = stockageMemoire();
  const chiffreur = await chiffreurWebCrypto();
  let clesOubliees = 0;
  const serveur = serveurFactice();
  let reseau: { surEtat: (x: boolean | null) => void; surReprise: () => void } | null = null;
  let arrets = 0;
  const surveiller: Surveiller = (surEtat, surReprise) => {
    reseau = { surEtat, surReprise };
    return () => {
      arrets += 1;
    };
  };
  const hl = assemblerHorsLigne({
    transport: serveur.transport,
    plateforme: { stockage: stockageChiffre(brut, chiffreur), oublierCle: async () => void (clesOubliees += 1), description: 'test' },
    surveiller,
  });
  return {
    hl,
    brut,
    serveur,
    clesOubliees: () => clesOubliees,
    arrets: () => arrets,
    /** Simule expo-network : coupure puis retour. */
    couper() {
      serveur.reseau = false;
      reseau?.surEtat(false);
    },
    retablir() {
      serveur.reseau = true;
      reseau?.surEtat(true);
      reseau?.surReprise();
    },
  };
}

test('Kayé écrit hors ligne : chiffré au repos, envoyé au retour du réseau', async () => {
  const m = await monter();
  await m.hl.ouvrir(MOI.id);
  m.couper();
  expect(m.hl.etat().enLigne).toBe(false);

  await expect(m.hl.file.soumettre(ev.kaye('vis_1', 'Léonie a gagné deux fois aux dominos.'))).rejects.toMatchObject({ code: 'EN_ATTENTE' });
  expect(m.hl.etat()).toMatchObject({ enLigne: false, enAttente: 1 });

  // Au repos : aucun texte du Kayé en clair.
  const brut = [...m.brut.brut().lignes.values()];
  expect(brut).toHaveLength(1);
  expect(brut[0]?.contenu.startsWith('v1:')).toBe(true);
  expect(brut[0]?.contenu).not.toMatch(/dominos|Léonie|humeur/);

  m.retablir();
  await laisserFinir();
  expect(m.serveur.acceptes()).toEqual(['KAYE_PUBLICATION']);
  expect(m.hl.etat()).toMatchObject({ enLigne: true, enAttente: 0 });
});

test('déconnexion : purge du cache, de la file, des méta et de la clé ; surveillance arrêtée', async () => {
  const m = await monter();
  await m.hl.ouvrir(MOI.id);
  await m.hl.cache.garderMoi(MOI);
  await m.hl.cache.garderVisites([]);
  m.couper();
  await m.hl.file.soumettre(ev.checkIn()).catch(() => undefined);
  await m.hl.file.soumettre(ev.kaye()).catch(() => undefined);
  expect(m.brut.brut().lignes.size).toBe(2);
  expect(m.brut.brut().cache.size).toBe(2);

  await m.hl.purger();
  expect(m.brut.brut().lignes.size).toBe(0);
  expect(m.brut.brut().cache.size).toBe(0);
  expect(await m.brut.lireMeta('compte')).toBeNull();
  expect(m.clesOubliees()).toBe(1);
  expect(m.arrets()).toBe(1);
  expect(m.hl.etat()).toMatchObject({ enAttente: 0, enLigne: null });

  // Le retour du réseau n'envoie rien : tout est effacé.
  m.serveur.reseau = true;
  await m.hl.synchroniser();
  expect(m.serveur.recus).toHaveLength(0);
});

test('un autre compte se connecte : la file du précédent est effacée, jamais envoyée en son nom', async () => {
  const m = await monter();
  await m.hl.ouvrir('acc_A');
  m.couper();
  await m.hl.file.soumettre(ev.kaye()).catch(() => undefined);
  m.serveur.reseau = true;
  await m.hl.ouvrir('acc_B');
  await laisserFinir();
  expect(m.serveur.recus).toHaveLength(0);
  expect(m.hl.etat().enAttente).toBe(0);
  expect(await m.brut.lireMeta('compte')).toBe('acc_B');
});

test('même compte à la réouverture : la file repart seule', async () => {
  const m = await monter();
  await m.hl.ouvrir(MOI.id);
  m.couper();
  await m.hl.file.soumettre(ev.checkOut()).catch(() => undefined);
  m.serveur.reseau = true;
  await m.hl.ouvrir(MOI.id);
  await laisserFinir();
  expect(m.serveur.acceptes()).toEqual(['CHECK_OUT']);
});
