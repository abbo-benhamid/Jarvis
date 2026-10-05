import { expect, test, type Locator, type Page } from '@playwright/test';
import type { JournalNatif, ScenarioNatif } from '../simule';

/**
 * Lot M4 sur l'export web SIMULÉ (`npm run export:web:simule`) : QR, position ponctuelle, SOS.
 * Les adaptateurs simulés remplacent caméra, GPS et téléphone. Écran 390 px.
 */
const SHOTS = process.env.SHOTS_DIR;

/** Centre l'élément : le pied d'action fixe ne le cache pas. */
async function centrer(l: Locator) {
  await l.evaluate((el) => el.scrollIntoView({ block: 'center' }));
}

async function capture(page: Page, nom: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${nom}.png`, fullPage: false });
}

async function ouvrirFiche(page: Page, scenario: ScenarioNatif = {}) {
  await page.addInitScript((s) => {
    (globalThis as { __KOUDMEN_NATIF__?: unknown }).__KOUDMEN_NATIF__ = s;
  }, scenario);
  await page.goto('/');
  await page.getByTestId('champ-email').fill('accompagnant@demo.koudmen.test');
  await page.getByTestId('champ-mot-de-passe').fill('koudmen');
  await page.getByTestId('bouton-connexion').click();
  await page.getByTestId('ouvrir-visite-vedette').click();
  await expect(page.getByTestId('carte-arrivee')).toBeVisible();
}

const journal = (page: Page) =>
  page.evaluate(() => (globalThis as { __KOUDMEN_NATIF_JOURNAL__?: JournalNatif }).__KOUDMEN_NATIF_JOURNAL__ ?? { lecturesPosition: 0, appels: [] });

async function sansDefilementHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
}

test('QR : explication, permission, lecture, le champ est rempli, puis arrivée', async ({ page }) => {
  await ouvrirFiche(page);
  await page.getByTestId('bouton-scanner').click();
  await expect(page.getByTestId('explication-camera')).toContainText('Aucune photo n’est prise ni gardée');
  await centrer(page.getByTestId('explication-camera'));
  await capture(page, '01-qr-explication');

  await page.getByTestId('autoriser-camera').click();
  await expect(page.getByTestId('vue-scanner')).toBeVisible();
  await centrer(page.getByTestId('vue-scanner'));
  await capture(page, '02-qr-viseur');

  await page.getByTestId('lire-qr-simule').click();
  await expect(page.getByTestId('vue-scanner')).toBeHidden();
  await expect(page.getByTestId('avis-qr')).toContainText('QR lu : code KDM482');
  await expect(page.getByTestId('champ-code-domicile')).toHaveValue('KDM482');
  await centrer(page.getByTestId('avis-qr'));
  await capture(page, '03-qr-lu');
  await sansDefilementHorizontal(page);

  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('retour-arrivee')).toContainText('Code du domicile');
  expect((await journal(page)).lecturesPosition).toBe(0);
});

test('QR étranger ou futur jeton signé : message clair, saisie manuelle possible', async ({ page }) => {
  await ouvrirFiche(page, { camera: 'accordee', qr: 'https://exemple.com/promo' });
  await page.getByTestId('bouton-scanner').click();
  await page.getByTestId('lire-qr-simule').click();
  await expect(page.getByTestId('avis-qr')).toContainText('n’est pas un code Koudmen');
  await expect(page.getByTestId('champ-code-domicile')).toHaveValue('');
  await centrer(page.getByTestId('avis-qr'));
  await capture(page, '04-qr-inconnu');

  await page.evaluate(() => {
    (globalThis as { __KOUDMEN_NATIF__?: { qr?: string } }).__KOUDMEN_NATIF__ = { qr: 'koudmen:domicile:s1:abc.def.ghi' };
  });
  await page.getByTestId('bouton-scanner').click();
  await page.getByTestId('autoriser-camera').click();
  await page.getByTestId('lire-qr-simule').click();
  await expect(page.getByTestId('avis-qr')).toContainText('pas encore accepté');

  await page.getByTestId('champ-code-domicile').fill('kdm-482');
  await expect(page.getByTestId('champ-code-domicile')).toHaveValue('KDM482');
});

test('caméra bloquée : lien vers les réglages, retour à la saisie', async ({ page }) => {
  await ouvrirFiche(page, { camera: 'bloquee' });
  await page.getByTestId('bouton-scanner').click();
  await expect(page.getByTestId('ouvrir-reglages-camera')).toBeVisible();
  await expect(page.getByTestId('explication-camera')).toContainText('bloqué');
  await page.getByTestId('annuler-scanner').click();
  await expect(page.getByTestId('bouton-scanner')).toBeVisible();
});

test('position : aucune lecture avant la validation, UNE lecture au check-in', async ({ page }) => {
  await ouvrirFiche(page);
  await page.getByTestId('accord-position').click();
  await expect(page.getByTestId('texte-accord-position')).toContainText('lecture unique');
  await centrer(page.getByTestId('texte-accord-position'));
  await capture(page, '05-position-accord');
  expect((await journal(page)).lecturesPosition).toBe(0);

  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('retour-arrivee')).toContainText('Position');
  expect((await journal(page)).lecturesPosition).toBe(1);

  // Départ et SOS ne lisent jamais la position.
  await page.getByTestId('bouton-sos').click();
  await page.getByTestId('bouton-envoyer-sos').click();
  await expect(page.getByTestId('consigne-sos')).toBeVisible();
  expect((await journal(page)).lecturesPosition).toBe(1);
});

test('position refusée : le code suffit, le refus est expliqué', async ({ page }) => {
  await ouvrirFiche(page, { position: 'bloquee' });
  await page.getByTestId('champ-code-domicile').fill('KDM482');
  await page.getByTestId('accord-position').click();
  await page.getByTestId('bouton-arrivee').click();
  const retour = page.getByTestId('retour-arrivee');
  await expect(retour).toContainText('Code du domicile');
  await expect(retour).toContainText('réglages du téléphone');
  await centrer(retour);
  await capture(page, '06-position-refusee');
});

test('position refusée sans code : erreur, rien n’est envoyé', async ({ page }) => {
  await ouvrirFiche(page, { position: 'refusee' });
  await page.getByTestId('accord-position').click();
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('erreur-fiche')).toContainText('refusé l’accès à la position');
  await expect(page.getByTestId('bouton-arrivee')).toBeVisible();
});

test('SOS : confirmation, appels 15 / 112, envoi de l’alerte', async ({ page }) => {
  await ouvrirFiche(page);
  await page.getByTestId('bouton-sos').click();
  const panneau = page.getByTestId('panneau-sos');
  await expect(panneau).toContainText('Alerter l’équipe Koudmen ?');
  await expect(panneau).toContainText('Votre position n’est pas envoyée');
  await capture(page, '07-sos-confirmation');
  await sansDefilementHorizontal(page);

  await page.getByTestId('appeler-112').click();
  expect((await journal(page)).appels).toEqual(['112']);

  await page.getByTestId('bouton-envoyer-sos').click();
  await expect(page.getByTestId('consigne-sos')).toContainText('15');
  await capture(page, '08-sos-envoye');
  await page.getByTestId('appeler-15').click();
  expect((await journal(page)).appels).toEqual(['112', '15']);
});

test.describe('thème sombre', () => {
  test.use({ colorScheme: 'dark' });
  test('captures sombres : viseur et SOS', async ({ page }) => {
    await ouvrirFiche(page, { camera: 'accordee' });
    await page.getByTestId('bouton-scanner').click();
    await centrer(page.getByTestId('vue-scanner'));
    await capture(page, '09-sombre-qr-viseur');
    await page.getByTestId('annuler-scanner').click();
    await page.getByTestId('bouton-sos').click();
    await expect(page.getByTestId('panneau-sos')).toBeVisible();
    await capture(page, '10-sombre-sos');
  });
});
