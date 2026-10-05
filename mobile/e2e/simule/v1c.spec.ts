import { expect, test, type Page } from '@playwright/test';

/**
 * Sprint V1c (revue UX V1) sur la démo simulée : pied d'action opaque (M3), vocabulaire unique (X4),
 * un seul code du domicile (X3), boutons jamais retirés du clavier (M8), « À propos et confidentialité » (X7).
 * `SHOTS_DIR=/chemin` : captures 360 / 390 px, clair / sombre.
 */
const SHOTS = process.env.SHOTS_DIR;
const TAILLES = [360, 390] as const;
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

async function sansDefilementHorizontal(page: Page, largeur: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
}

/** Le pied d'action a un fond opaque, et le dernier élément du formulaire défile AU-DESSUS de lui. */
async function piedOpaqueSansChevauchement(page: Page, dernier: string) {
  const pied = page.getByTestId('pied-action').last();
  const fond = await pied.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fond).not.toBe('rgba(0, 0, 0, 0)');
  expect(fond).not.toMatch(/rgba\(.*, 0(\.\d+)?\)$/);
  const champ = page.getByTestId(dernier);
  // Défilement tout en bas : le champ doit finir au-dessus du pied (fondu de 32 px compris).
  await page.evaluate(() => document.querySelectorAll('div').forEach((d) => d.scrollHeight > d.clientHeight && (d.scrollTop = d.scrollHeight)));
  const boiteChamp = await champ.boundingBox();
  const boitePied = await pied.boundingBox();
  expect(boiteChamp && boitePied && boiteChamp.y + boiteChamp.height <= boitePied.y - 16).toBe(true);
}

test.describe('V1c : Kayé', () => {
  for (const largeur of TAILLES) {
    for (const theme of THEMES) {
      test(`Kayé ${largeur} px ${theme} : pied opaque, « Envoyer le Kayé », humeur de « Très bien » à « Pas bien »`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.emulateMedia({ colorScheme: theme });
        await seConnecter(page);
        await page.getByTestId('ouvrir-visite-vedette').click();
        await page.getByTestId('champ-code-domicile').fill('LKW7Q3');
        await page.getByTestId('bouton-arrivee').click();
        await page.getByTestId('bouton-ecrire-kaye').click();
        await expect(page.getByTestId('ecran-kaye-formulaire')).toBeVisible();

        const humeurs = await page.getByTestId('humeur').getByRole('radio').allInnerTexts();
        expect(humeurs.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(['Très bien', 'Bien', 'Correct', 'Pas très bien', 'Pas bien']);
        await expect(page.getByRole('radio', { name: 'Non observé' })).toBeVisible();
        await expect(page.getByTestId('bouton-envoyer-kaye')).toContainText('Envoyer le Kayé');
        await capture(page, `kaye-${largeur}-${theme}`);
        await sansDefilementHorizontal(page, largeur);
        await piedOpaqueSansChevauchement(page, 'aide-kaye');
        await capture(page, `kaye-${largeur}-${theme}-bas`);
      });
    }
  }

  test('M8 : « Envoyer le Kayé » reste au clavier ; au toucher, chaque manque est dit près du champ', async ({ page }) => {
    await seConnecter(page);
    await page.getByTestId('ouvrir-visite-vedette').click();
    await page.getByTestId('champ-code-domicile').fill('LKW7Q3');
    await page.getByTestId('bouton-arrivee').click();
    await page.getByTestId('bouton-ecrire-kaye').click();
    const bouton = page.getByTestId('bouton-envoyer-kaye');
    await expect(bouton).not.toHaveAttribute('tabindex', '-1');
    await expect(bouton).toBeEnabled();
    await bouton.focus();
    await expect(bouton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('humeur-erreur')).toHaveText('Choisissez l’humeur.');
    await expect(page.getByTestId('appetit-erreur')).toHaveText('Choisissez l’appétit.');
    await expect(page.getByTestId('manques-kaye')).toContainText('Il manque 2 réponses');
    await capture(page, 'kaye-390-light-manques');
    await page.getByRole('radio', { name: 'Bien', exact: true }).click();
    await page.getByRole('radio', { name: 'Bon', exact: true }).click();
    await bouton.click();
    await expect(page.getByTestId('ecran-kaye-fini')).toContainText('Kayé envoyé.');
  });
});

test.describe('V1c : fiche visite', () => {
  for (const largeur of TAILLES) {
    for (const theme of THEMES) {
      test(`fiche ${largeur} px ${theme} : « 0 preuve sur 3 », Scanner OU Saisir le même code`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.emulateMedia({ colorScheme: theme });
        await seConnecter(page);
        await page.getByTestId('ouvrir-visite-vedette').click();
        const fiche = page.getByTestId('ecran-fiche-visite');
        await expect(fiche.getByTestId('badge-preuve')).toHaveText('0 preuve sur 3');
        await expect(fiche).not.toContainText('Preuve 0/2');
        await expect(fiche.getByTestId('etape-GPS')).toContainText('Position à l’arrivée');
        await expect(fiche.getByTestId('etape-CODE_DOMICILE')).toContainText('Code du domicile');
        await expect(fiche.getByTestId('etape-CONFIRMATION_AINE')).toContainText('Confirmation de l’aîné');
        await expect(fiche.getByTestId('explication-code')).toContainText('c’est le même');
        await expect(fiche.getByTestId('bouton-scanner')).toBeVisible();
        await expect(fiche.getByTestId('bouton-saisir')).toBeVisible();
        await capture(page, `fiche-${largeur}-${theme}`);
        await page.getByTestId('carte-arrivee').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await capture(page, `fiche-${largeur}-${theme}-arrivee`);
        await sansDefilementHorizontal(page, largeur);
      });
    }
  }

  test('M8 : « Valider mon arrivée » sans preuve → le champ dit ce qui manque et reçoit le focus ; « Saisir » donne le focus', async ({ page }) => {
    await seConnecter(page);
    await page.getByTestId('ouvrir-visite-vedette').click();
    await page.getByTestId('bouton-arrivee').click();
    await expect(page.getByTestId('ecran-fiche-visite')).toContainText('Entrez le code du domicile, ou acceptez la lecture de la position plus bas.');
    await expect(page.getByTestId('champ-code-domicile')).toBeFocused();
    await page.getByTestId('bouton-scanner').focus();
    await page.getByTestId('bouton-saisir').click();
    await expect(page.getByTestId('champ-code-domicile')).toBeFocused();
    await page.getByTestId('champ-code-domicile').fill('LKW7Q3');
    await page.getByTestId('bouton-arrivee').click();
    await expect(page.getByTestId('retour-arrivee')).toContainText('Code du domicile');
    await expect(page.getByTestId('badge-preuve')).toHaveText('1 preuve sur 3');
  });
});

test.describe('V1c : profil et « À propos et confidentialité »', () => {
  for (const largeur of TAILLES) {
    for (const theme of THEMES) {
      test(`profil et à propos ${largeur} px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.emulateMedia({ colorScheme: theme });
        await seConnecter(page);
        await page.getByTestId('onglet-profil').click();
        await expect(page.getByTestId('ecran-profil')).toContainText('Me déconnecter');
        await page.getByTestId('lien-a-propos').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await capture(page, `profil-${largeur}-${theme}`);
        await page.getByTestId('lien-a-propos').click();
        const ecran = page.getByTestId('ecran-a-propos');
        await expect(ecran).toContainText('Qui édite Koudmen ?');
        await expect(ecran).toContainText('Stockage chiffré');
        await expect(ecran).toContainText('Notifications');
        await expect(ecran.getByTestId('lien-confidentialite')).toBeVisible();
        await expect(ecran.getByTestId('lien-mentions-legales')).toBeVisible();
        await capture(page, `a-propos-${largeur}-${theme}`);
        await ecran.getByTestId('carte-telephone').evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await capture(page, `a-propos-${largeur}-${theme}-suite`);
        await sansDefilementHorizontal(page, largeur);
      });
    }
  }

  test('à propos lisible depuis l’écran de connexion, sans compte', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('lien-a-propos-connexion').click();
    await expect(page.getByTestId('ecran-a-propos')).toContainText('Koudmen ouvre bientôt en Martinique');
    await page.getByRole('button', { name: 'Retour', exact: true }).click();
    await expect(page.getByTestId('ecran-connexion')).toBeVisible();
  });

  test('M8 : « Me connecter » sans e-mail → messages près des champs, bouton resté au clavier', async ({ page }) => {
    await page.goto('/');
    const bouton = page.getByTestId('bouton-connexion');
    await expect(bouton).not.toHaveAttribute('tabindex', '-1');
    await bouton.click();
    await expect(page.getByTestId('ecran-connexion')).toContainText('Entrez votre e-mail.');
    await expect(page.getByTestId('ecran-connexion')).toContainText('Entrez votre mot de passe.');
  });
});
