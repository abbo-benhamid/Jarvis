import { expect, test, type Page } from '@playwright/test';
import { EMAIL_DEMO, ENV_PLATEFORME, nettoyer, preparer, reinitialiserLimitesConnexion, type Donnees } from './donnees';

/**
 * Lot M2 : l'app (export web) contre le VRAI serveur local (plateforme/, DEMO_MODE=true).
 * Parcours : connexion → visites → fiche → check-in code → SOS → Kayé (brouillon puis publication)
 *            → départ → propositions (refus sans pénalité, acceptation) → déconnexion.
 * Captures 390 px clair et sombre si SHOTS_DIR est défini.
 */

const MOT_DE_PASSE = process.env.DEMO_PASSWORD ?? ENV_PLATEFORME.DEMO_PASSWORD ?? '';
const DOSSIER = process.env.SHOTS_DIR;

async function seConnecter(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('ecran-connexion')).toBeVisible();
  await page.getByTestId('champ-email').fill(EMAIL_DEMO);
  await page.getByTestId('champ-mot-de-passe').fill(MOT_DE_PASSE);
  await page.getByTestId('bouton-connexion').click();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
}

/** L'écran défile dans une ScrollView : pour une capture longue, la fenêtre prend la hauteur du contenu. */
async function capturerDefilement(page: Page, testId: string, chemin: string) {
  const hauteur = await page.evaluate((id) => {
    const ecran = document.querySelector(`[data-testid="${id}"]`);
    let max = 844;
    ecran?.querySelectorAll('div').forEach((d) => {
      if (d.scrollHeight > d.clientHeight + 4) max = Math.max(max, d.scrollHeight + (window.innerHeight - d.clientHeight));
    });
    return Math.min(max, 3600);
  }, testId);
  await page.setViewportSize({ width: 390, height: hauteur });
  await page.waitForTimeout(300);
  await page.screenshot({ path: chemin });
  await page.setViewportSize({ width: 390, height: 844 });
}

/** Fait défiler la zone de contenu d'un écran jusqu'en bas. */
async function defilerEnBas(page: Page, testId: string) {
  await page.evaluate((id) => {
    document.querySelector(`[data-testid="${id}"]`)?.querySelectorAll('div').forEach((d) => {
      if (d.scrollHeight > d.clientHeight + 4) d.scrollTop = d.scrollHeight;
    });
  }, testId);
  await page.waitForTimeout(250);
}

test.beforeAll(async () => {
  await reinitialiserLimitesConnexion();
});

test('mauvais mot de passe : message clair du serveur', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('champ-email').fill(EMAIL_DEMO);
  await page.getByTestId('champ-mot-de-passe').fill('pas-le-bon');
  await page.getByTestId('bouton-connexion').click();
  await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test.describe(`parcours accompagnant (${theme})`, () => {
    test.use({ colorScheme: theme });
    let donnees: Donnees | undefined;

    test.beforeAll(async () => {
      donnees = await preparer();
    });
    test.afterAll(async () => {
      if (donnees) await nettoyer(donnees);
    });

    test(`connexion → visites → fiche → check-in → Kayé → propositions (${theme})`, async ({ page }) => {
      const d = donnees!;
      const capture = async (nom: string, ecran?: string) => {
        if (!DOSSIER) return;
        await page.waitForTimeout(450);
        await page.screenshot({ path: `${DOSSIER}/${nom}-${theme === 'light' ? 'clair' : 'sombre'}.png` });
        if (ecran) await capturerDefilement(page, ecran, `${DOSSIER}/${nom}-${theme === 'light' ? 'clair' : 'sombre'}-long.png`);
      };

      // 1. Connexion (PKCE → jetons → /me).
      await page.goto('/');
      await expect(page.getByTestId('ecran-connexion')).toBeVisible();
      await capture('01-connexion');
      await seConnecter(page);
      await expect(page.getByRole('heading', { name: /Bonjou, / })).toBeVisible();

      // 2. Visites du jour : la visite de test est à l'affiche, avec les propositions en attente.
      await expect(page.getByTestId('visite-vedette')).toContainText(d.aine);
      await expect(page.getByTestId('lien-propositions')).toContainText('sans pénalité');
      await capture('02-visites', 'ecran-visites');

      // 3. Fiche : pas de code du domicile affiché ; check-in par code.
      await page.getByTestId('ouvrir-visite-vedette').click();
      await expect(page).toHaveURL(new RegExp(`/visite/${d.visiteId}`));
      const fiche = page.getByTestId('ecran-fiche-visite');
      await expect(fiche.getByTestId('carte-preuves')).toContainText('Code du domicile');
      await expect(fiche).not.toContainText(d.codeDomicile);
      await expect(page.getByTestId('bouton-arrivee')).toHaveAttribute('aria-disabled', 'true');
      await capture('03-fiche', 'ecran-fiche-visite');

      await page.getByTestId('champ-code-domicile').fill(d.codeDomicile);
      await page.getByTestId('bouton-arrivee').click();
      await expect(page.getByTestId('retour-arrivee')).toContainText('Code du domicile');
      await expect(page.getByTestId('etape-CODE_DOMICILE')).toContainText('Validé');
      await expect(page.getByTestId('bouton-ecrire-kaye')).toBeVisible();
      await capture('04-fiche-arrivee', 'ecran-fiche-visite');

      // 4. SOS : discret dans l'en-tête, confirmation, consigne 15 / 112.
      await page.getByTestId('bouton-sos').click();
      await expect(page.getByTestId('panneau-sos')).toContainText('Alerter l’équipe Koudmen ?');
      await capture('05-sos-confirmation');
      await page.getByTestId('bouton-envoyer-sos').click();
      await expect(page.getByTestId('consigne-sos')).toContainText('15');
      await page.getByRole('button', { name: 'Fermer' }).click();

      // 5. Kayé : brouillon gardé côté serveur, puis publication.
      await page.getByTestId('bouton-ecrire-kaye').click();
      const formulaire = page.getByTestId('ecran-kaye-formulaire');
      await expect(formulaire).toBeVisible();
      await page.getByRole('radio', { name: 'Bien', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Discussion' }).click();
      await page.getByTestId('bouton-brouillon-kaye').click();
      await expect(page.getByTestId('ecran-kaye-fini')).toContainText('Brouillon gardé.');
      // Sur le web, le jeton reste en mémoire : on navigue dans l'app (pas de rechargement de page).
      await page.getByRole('button', { name: 'Retour aux visites' }).click();
      await page.getByTestId('ouvrir-visite-vedette').click();
      await page.getByTestId('bouton-ecrire-kaye').click();
      await expect(page.getByRole('radio', { name: 'Bien', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('checkbox', { name: 'Discussion' })).toHaveAttribute('aria-checked', 'true');

      await page.getByRole('radio', { name: 'Bon', exact: true }).click();
      await page.getByTestId('champ-note').fill('Nous avons parlé du jardin. Belle matinée (test e2e).');
      await page.getByRole('switch', { name: 'À surveiller' }).click();
      await page.getByTestId('champ-a-surveiller').fill('Elle boit peu (test e2e).');

      // Correctif M2 : en bas du défilement, le champ « Qu'avez-vous remarqué ? » reste au-dessus du pied d'action.
      await defilerEnBas(page, 'ecran-kaye-formulaire');
      const champ = await page.getByTestId('champ-a-surveiller').boundingBox();
      const aide = await page.getByText('Urgence : appelez le 15 ou le 112.').boundingBox();
      const envoyer = await page.getByTestId('bouton-envoyer-kaye').boundingBox();
      expect(champ && aide && envoyer).toBeTruthy();
      expect(champ!.y + champ!.height).toBeLessThanOrEqual(envoyer!.y);
      expect(aide!.y + aide!.height).toBeLessThanOrEqual(envoyer!.y);
      await capture('06-kaye-bas');
      await capture('06-kaye', 'ecran-kaye-formulaire');

      await page.getByTestId('bouton-envoyer-kaye').click();
      await expect(page.getByTestId('ecran-kaye-fini')).toContainText('Kayé envoyé.');
      await capture('07-kaye-envoye');

      // 6. Départ (check-out, sans position).
      await page.getByRole('button', { name: 'Retour aux visites' }).click();
      await page.getByTestId(`visite-${d.visiteId}`).click();
      await expect(page.getByTestId(`ecran-fiche-visite`)).toBeVisible();
      await page.getByTestId('bouton-depart').click();
      await expect(page.getByText('Kayé envoyé à la famille. Merci.')).toBeVisible();

      // 7. Propositions : refuser (sans pénalité), accepter.
      await page.getByRole('button', { name: 'Retour aux visites' }).first().click();
      await page.getByTestId('lien-propositions').click();
      await expect(page.getByTestId('regle-sans-penalite')).toContainText('sans pénalité');
      await expect(page.getByTestId(`proposition-${d.propositionRefus}`)).toBeVisible();
      await capture('08-propositions', 'ecran-propositions');
      await page.getByTestId(`refuser-${d.propositionRefus}`).click();
      await expect(page.getByTestId(`proposition-${d.propositionRefus}`)).toContainText('aucun effet sur votre profil');
      await page.getByTestId(`note-refus-${d.propositionRefus}`).fill('Pas disponible le mardi (test e2e).');
      await page.getByTestId(`confirmer-refus-${d.propositionRefus}`).click();
      await expect(page.getByTestId('annonce-proposition')).toContainText('Aucune pénalité');
      await page.getByTestId(`accepter-${d.propositionAccord}`).click();
      await expect(page.getByTestId('annonce-proposition')).toContainText('Mission acceptée');
      await capture('09-proposition-acceptee');

      // 8. Profil, puis déconnexion (jeton révoqué côté serveur).
      await page.getByRole('button', { name: 'Retour', exact: true }).click();
      await page.getByTestId('onglet-profil').click();
      await expect(page.getByTestId('ecran-profil')).toContainText(EMAIL_DEMO);
      await capture('10-profil');
      await page.getByTestId('bouton-deconnexion').click();
      await expect(page.getByTestId('ecran-connexion')).toBeVisible();
    });
  });
}

test('renouvellement UN PAR UN : deux 401 simultanés → un seul /auth/refresh', async ({ page }) => {
  await seConnecter(page);

  let renouvellements = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/auth/refresh')) renouvellements += 1;
  });
  // Le jeton d'accès « expire » : les deux prochains appels (visites + propositions) répondent 401.
  const refuser401 = async (route: import('@playwright/test').Route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ erreur: { code: 'NON_AUTHENTIFIE', message: 'Votre session a expiré.' } }),
    });
  };
  await page.route('**/api/v1/visites?jours=7', refuser401, { times: 1 });
  await page.route('**/api/v1/propositions', refuser401, { times: 1 });

  await page.getByTestId('onglet-profil').click();
  await page.getByTestId('onglet-visites').click();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bonjou, / })).toBeVisible();
  await expect(page.getByTestId('erreur-visites')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(renouvellements).toBe(1);

  await page.getByTestId('onglet-profil').click();
  await page.getByTestId('bouton-deconnexion').click();
  await expect(page.getByTestId('ecran-connexion')).toBeVisible();
});
