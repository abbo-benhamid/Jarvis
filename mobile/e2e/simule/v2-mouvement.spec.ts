import { expect, test, type Page } from '@playwright/test';

/**
 * Sprint V2-app : micro-animations (direction artistique § 9) et langage de lancement.
 * - Animations : elles finissent à l'état complet ; « Réduire les animations » fige tout à l'état final.
 * - Langage : plus de « test », « fictif », « version de test » à l'écran ; l'indice du code reste court.
 * `SHOTS_DIR=/chemin` : captures 390 px, clair / sombre.
 */
const SHOTS = process.env.SHOTS_DIR;
const THEMES = ['light', 'dark'] as const;

async function capture(page: Page, nom: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${nom}.png` });
}

async function seConnecter(page: Page) {
  await page.goto('/');
  await page.getByTestId('champ-email').fill('accompagnant@demo.koudmen.test');
  await page.getByTestId('champ-mot-de-passe').fill('koudmen');
  await page.getByTestId('bouton-connexion').click();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
}

/** Arrivée avec le code, puis Kayé envoyé. */
async function arriveeEtKaye(page: Page, captures?: string) {
  await page.getByTestId('ouvrir-visite-vedette').click();
  await page.getByTestId('champ-code-domicile').fill('LKW7Q3');
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('retour-arrivee')).toContainText('Code du domicile');
  if (captures) {
    await page.waitForTimeout(700);
    await page.getByTestId('carte-preuves').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await capture(page, `${captures}-preuves`);
  }
  await page.getByTestId('bouton-ecrire-kaye').click();
  await page.getByRole('radio', { name: 'Bien', exact: true }).click();
  await page.getByRole('radio', { name: 'Bon', exact: true }).click();
  await page.getByTestId('bouton-envoyer-kaye').click();
  await expect(page.getByTestId('ecran-kaye-fini')).toContainText('Kayé envoyé.');
}

test.describe('V2-app : micro-animations', () => {
  for (const theme of THEMES) {
    test(`390 px ${theme} : coche, compteur, succès du Kayé finissent à l'état complet`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await seConnecter(page);
      await page.waitForTimeout(600);
      await capture(page, `v2-visites-390-${theme}`);
      await arriveeEtKaye(page, `v2-fiche-390-${theme}`);
      const succes = page.getByTestId('succes-anime');
      await expect(succes).toHaveCSS('opacity', '1');
      await page.waitForTimeout(700);
      await capture(page, `v2-kaye-envoye-390-${theme}`);
    });
  }

  test('« Réduire les animations » : tout est figé à l’état final, dès la première image', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seConnecter(page);
    // La carte du jour est là, sans translation ni fondu.
    const vedette = page.getByTestId('visite-vedette');
    const parent = vedette.locator('xpath=..');
    expect(await parent.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    await arriveeEtKaye(page);
    // Le rond de succès est plein tout de suite (pas d'attente).
    expect(await page.getByTestId('succes-anime').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    expect(await page.getByTestId('succes-anime').locator('path').getAttribute('stroke-dashoffset')).toBe('0');
  });
});

test.describe('V2-app : langage de lancement', () => {
  const INTERDITS = /version de test|prototype|fictif|fictive|démo|démonstration/i;

  test('connexion, visites, fiche, profil, à propos : aucun mot de test', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('ecran-connexion')).not.toContainText(INTERDITS);
    await page.getByTestId('lien-a-propos-connexion').click();
    const aPropos = page.getByTestId('ecran-a-propos');
    await expect(aPropos).toContainText('Koudmen ouvre bientôt en Martinique');
    await expect(aPropos).not.toContainText(INTERDITS);
    await page.getByRole('button', { name: 'Retour', exact: true }).click();

    await seConnecter(page);
    await expect(page.getByTestId('ecran-visites')).not.toContainText(INTERDITS);
    await page.getByTestId('ouvrir-visite-vedette').click();
    const fiche = page.getByTestId('ecran-fiche-visite');
    // Mode simulé seulement : indice court.
    await expect(fiche).toContainText('Code d’exemple : LKW7Q3');
    await expect(fiche).not.toContainText(INTERDITS);
    await page.getByRole('button', { name: 'Retour aux visites' }).click();
    await page.getByTestId('onglet-profil').click();
    await expect(page.getByTestId('ecran-profil')).not.toContainText(INTERDITS);
  });
});
