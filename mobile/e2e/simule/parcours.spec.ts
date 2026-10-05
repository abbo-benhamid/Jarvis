import { expect, test, type Page } from '@playwright/test';

/**
 * Démo hors ligne (adaptateur simulé, mêmes formes que l'API v1).
 * Connexion → visites → fiche → arrivée (code) → Kayé → propositions → déconnexion.
 */

async function seConnecter(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('ecran-connexion')).toBeVisible();
  await page.getByTestId('champ-email').fill('accompagnant@demo.koudmen.test');
  await page.getByTestId('champ-mot-de-passe').fill('koudmen');
  await page.getByTestId('bouton-connexion').click();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
}

test('connexion simulée, visites, fiche, arrivée, Kayé', async ({ page }) => {
  await seConnecter(page);
  await expect(page.getByRole('heading', { name: /Bonjou, Josiane/ })).toBeVisible();
  await expect(page.getByTestId('visite-vedette')).toContainText('Léonie B.');

  await page.getByTestId('ouvrir-visite-vedette').click();
  const fiche = page.getByTestId('ecran-fiche-visite');
  await expect(fiche.getByTestId('etape-GPS')).toContainText('Position à l’arrivée');
  await page.getByTestId('champ-code-domicile').fill('KDM482');
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('retour-arrivee')).toContainText('Code du domicile');

  await page.getByTestId('bouton-ecrire-kaye').click();
  await page.getByRole('radio', { name: 'Bien', exact: true }).click();
  await page.getByRole('radio', { name: 'Bon', exact: true }).click();
  await page.getByTestId('bouton-envoyer-kaye').click();
  await expect(page.getByTestId('ecran-kaye-fini')).toContainText('Kayé envoyé.');

  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(390);
});

test('propositions : refus sans pénalité', async ({ page }) => {
  await seConnecter(page);
  await page.getByTestId('lien-propositions').click();
  await expect(page.getByTestId('regle-sans-penalite')).toContainText('sans pénalité');
  await page.getByTestId('refuser-prop_ginette').click();
  await page.getByTestId('confirmer-refus-prop_ginette').click();
  await expect(page.getByTestId('annonce-proposition')).toContainText('Aucune pénalité');
});
