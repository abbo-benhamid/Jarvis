import { expect, test, type Page } from '@playwright/test';

/**
 * Critère de fin du lot M1 (ADR 0008 § 6) :
 * connexion simulée → liste de visites → fiche visite, à 390 px.
 * Puis : preuves d'arrivée → Kayé rapide → envoi.
 */

async function seConnecter(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('ecran-connexion')).toBeVisible();
  await page.getByTestId('champ-telephone').fill('0696 12 34 56');
  await page.getByTestId('bouton-recevoir-code').click();
  await page.getByTestId('champ-code').fill('123456');
  await page.getByTestId('bouton-connexion').click();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
}

test('connexion simulée, liste des visites, fiche visite', async ({ page }) => {
  await seConnecter(page);

  await expect(page.getByRole('heading', { name: /Bonjou, Josiane/ })).toBeVisible();
  await expect(page.getByTestId('visite-vedette')).toContainText('Léonie Bellance');
  await expect(page.getByText('Les 7 prochains jours')).toBeVisible();

  await page.getByTestId('ouvrir-visite-vedette').click();
  const fiche = page.getByTestId('ecran-fiche-visite');
  await expect(fiche).toBeVisible();
  await expect(fiche.getByTestId('etape-POSITION')).toContainText('Position au domicile');
  await expect(fiche.getByTestId('etape-CODE')).toContainText('Code du domicile');
  await expect(fiche.getByTestId('etape-CONFIRMATION_AINE')).toContainText('Confirmation de Léonie');
  await expect(fiche.getByTestId('badge-preuve')).toContainText('Preuve 1/2');

  // Pas de défilement horizontal à 390 px.
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(390);
});

test('preuves, puis Kayé rapide envoyé', async ({ page }) => {
  await seConnecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();

  // Code du domicile, saisi à la main (le scan arrive au lot M4).
  await page.getByRole('button', { name: 'Saisir le code à la main' }).click();
  await page.getByTestId('champ-code-domicile').fill('4821');
  await page.getByRole('button', { name: 'Valider le code' }).click();
  await expect(page.getByTestId('verdict-preuve')).toContainText('2 preuves sur 3');
  await expect(page.getByTestId('ecran-fiche-visite').getByTestId('badge-preuve')).toContainText('Prouvée');

  await page.getByTestId('bouton-ecrire-kaye').click();
  await expect(page.getByTestId('ecran-kaye-formulaire')).toBeVisible();
  const envoyer = page.getByTestId('bouton-envoyer-kaye');
  await expect(envoyer).toHaveAttribute('aria-disabled', 'true');

  await page.getByRole('radio', { name: 'Bonne' }).click();
  await page.getByRole('radio', { name: 'Moyen' }).click();
  await page.getByTestId('champ-note').fill('Nous avons joué aux dominos.');
  await page.getByRole('switch', { name: 'À surveiller' }).click();
  await expect(envoyer).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('champ-a-surveiller').fill('Elle boit peu.');
  await envoyer.click();

  await expect(page.getByTestId('ecran-kaye-fini')).toContainText('Kayé envoyé.');
});

test('onglets Kayé et Profil, déconnexion', async ({ page }) => {
  await seConnecter(page);
  await page.getByTestId('onglet-kaye').click();
  await expect(page.getByTestId('ecran-kaye')).toBeVisible();
  await expect(page.getByTestId('onglet-kaye')).toHaveAttribute('aria-selected', 'true');

  await page.getByTestId('onglet-profil').click();
  await expect(page.getByTestId('ecran-profil')).toContainText('Josiane Mathurin');
  await page.getByTestId('bouton-deconnexion').click();
  await expect(page.getByTestId('ecran-connexion')).toBeVisible();
});
