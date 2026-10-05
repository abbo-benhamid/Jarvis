import { expect, test, type Page } from '@playwright/test';

/**
 * Captures 390 px, clair et sombre. Lancées seulement si SHOTS_DIR est défini :
 *   SHOTS_DIR=/chemin npm run e2e -- captures
 */
const DOSSIER = process.env.SHOTS_DIR;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`captures ${theme}`, () => {
    test.skip(!DOSSIER, 'SHOTS_DIR non défini');
    test.use({ colorScheme: theme });

    test(`écrans en ${theme}`, async ({ page }) => {
      const prendre = async (nom: string, pleinePage = false) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: `${DOSSIER}/${nom}-${theme}.png`, fullPage: pleinePage });
      };
      const pleine = async (nom: string, testId: string) => {
        await page.waitForTimeout(450);
        await capturerDefilement(page, testId, `${DOSSIER}/${nom}-${theme}-long.png`);
      };

      await page.goto('/');
      await expect(page.getByTestId('ecran-connexion')).toBeVisible();
      await prendre('01-connexion');
      await page.getByTestId('champ-telephone').fill('0696 12 34 56');
      await page.getByTestId('bouton-recevoir-code').click();
      await page.getByTestId('champ-code').fill('123456');
      await page.getByTestId('bouton-connexion').click();

      await expect(page.getByTestId('ecran-visites')).toBeVisible();
      await prendre('02-visites');
      await pleine('02-visites', 'ecran-visites');

      await page.getByTestId('ouvrir-visite-vedette').click();
      await expect(page.getByTestId('ecran-fiche-visite')).toBeVisible();
      await prendre('03-fiche-visite');
      await pleine('03-fiche-visite', 'ecran-fiche-visite');

      await page.getByRole('button', { name: 'Saisir le code à la main' }).click();
      await page.getByTestId('champ-code-domicile').fill('4821');
      await page.getByRole('button', { name: 'Valider le code' }).click();
      await expect(page.getByTestId('verdict-preuve')).toBeVisible();
      await pleine('04-fiche-prouvee', 'ecran-fiche-visite');

      await page.getByTestId('bouton-ecrire-kaye').click();
      await expect(page.getByTestId('ecran-kaye-formulaire')).toBeVisible();
      await page.getByRole('radio', { name: 'Bonne' }).click();
      await page.getByRole('radio', { name: 'Bon', exact: true }).click();
      await page.getByRole('switch', { name: 'À surveiller' }).click();
      await prendre('05-kaye');
      await pleine('05-kaye', 'ecran-kaye-formulaire');

      await page.getByTestId('champ-a-surveiller').fill('Elle boit peu.');
      await page.getByTestId('bouton-envoyer-kaye').click();
      await expect(page.getByTestId('ecran-kaye-fini')).toBeVisible();
      await prendre('06-kaye-envoye');
    });

    test(`onglets en ${theme}`, async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('champ-telephone').fill('0696 12 34 56');
      await page.getByTestId('bouton-recevoir-code').click();
      await page.getByTestId('champ-code').fill('123456');
      await page.getByTestId('bouton-connexion').click();
      await page.getByTestId('onglet-kaye').click();
      await expect(page.getByTestId('ecran-kaye')).toBeVisible();
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${DOSSIER}/07-onglet-kaye-${theme}.png` });
      await page.getByTestId('onglet-profil').click();
      await expect(page.getByTestId('ecran-profil')).toBeVisible();
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${DOSSIER}/08-onglet-profil-${theme}.png` });
      await capturerDefilement(page, 'ecran-profil', `${DOSSIER}/08-onglet-profil-${theme}-long.png`);
    });
  });
}

/**
 * L'écran défile dans une ScrollView, pas dans la page. Pour une capture « longue »,
 * on agrandit la fenêtre à la hauteur du contenu, puis on la remet à 844 px.
 */
async function capturerDefilement(page: Page, testId: string, chemin: string) {
  const hauteur = await page.evaluate((id) => {
    const ecran = document.querySelector(`[data-testid="${id}"]`);
    let max = 844;
    ecran?.querySelectorAll('div').forEach((d) => {
      if (d.scrollHeight > d.clientHeight + 4) max = Math.max(max, d.scrollHeight + (window.innerHeight - d.clientHeight));
    });
    return Math.min(max, 3200);
  }, testId);
  await page.setViewportSize({ width: 390, height: hauteur });
  await page.waitForTimeout(300);
  await page.screenshot({ path: chemin });
  await page.setViewportSize({ width: 390, height: 844 });
}
