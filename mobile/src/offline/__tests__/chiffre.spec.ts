import { expect, test } from '@playwright/test';
import { depuisUtf8, stockageChiffre, versUtf8 } from '../chiffre';
import { stockageMemoire } from '../memoire';
import { chiffreurWebCrypto } from './aides';

/** Chiffrement au repos (lot M3) : format, données illisibles, UTF-8. */

test('UTF-8 : aller-retour (accents, créole, emoji) et identique à TextEncoder', () => {
  for (const t of ['', 'Léonie', 'Mèsi anpil, sa ka maché !', 'Gâteau 🍰 et 🌺', '€ ≠ $']) {
    expect(depuisUtf8(versUtf8(t))).toBe(t);
    expect([...versUtf8(t)]).toEqual([...new TextEncoder().encode(t)]);
  }
  expect(() => depuisUtf8(Uint8Array.from([0xc3]))).toThrow();
});

test('stockage chiffré : rien en clair au repos, lecture transparente', async () => {
  const brut = stockageMemoire();
  const s = stockageChiffre(brut, await chiffreurWebCrypto());
  await s.ecrireCache('visite:v1', { valeur: '{"consignes":"Clé sous le pot de fleurs"}', enregistreA: 1 });
  await s.ecrireLigne({ id: 'e1', seq: 1, type: 'KAYE_PUBLICATION', visiteId: 'v1', statut: 'EN_ATTENTE', tentatives: 0, contenu: '{"note":"Elle boit peu"}' });

  expect(brut.brut().cache.get('visite:v1')?.valeur).not.toContain('pot de fleurs');
  expect(brut.brut().lignes.get('e1')?.contenu).not.toContain('boit peu');
  expect((await s.lireCache('visite:v1'))?.valeur).toContain('pot de fleurs');
  expect((await s.listerLignes())[0]?.contenu).toContain('boit peu');
});

test('clé changée (purge, réinstallation) : les données illisibles sont effacées, jamais renvoyées', async () => {
  const brut = stockageMemoire();
  const avant = stockageChiffre(brut, await chiffreurWebCrypto());
  await avant.ecrireCache('moi', { valeur: '{}', enregistreA: 1 });
  await avant.ecrireLigne({ id: 'e1', seq: 1, type: 'SOS', visiteId: null, statut: 'EN_ATTENTE', tentatives: 0, contenu: '{}' });

  const apres = stockageChiffre(brut, await chiffreurWebCrypto());
  expect(await apres.lireCache('moi')).toBeNull();
  expect(await apres.listerLignes()).toEqual([]);
  expect(brut.brut().cache.size).toBe(0);
  expect(brut.brut().lignes.size).toBe(0);
});
