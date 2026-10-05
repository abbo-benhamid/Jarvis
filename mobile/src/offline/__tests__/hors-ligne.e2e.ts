import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Lot M3 — e2e sur l'export web, coupure réseau RÉELLE du navigateur (`context.setOffline`).
 * Kayé écrit hors ligne → gardé → envoyé au retour du réseau, une seule fois.
 * Captures (facultatif) : SHOTS_DIR=/chemin.
 */

const API = `http://localhost:${process.env.PORT_API ?? 4331}`;
const SHOTS = process.env.SHOTS_DIR;
const NOTE = 'Nous avons joué aux dominos. Léonie a gagné deux fois.';

type Journal = { recus: { type: string; clientEventId: string; kaye?: { note?: string } }[]; traites: { type: string; statut: string }[] };
const journal = async (request: APIRequestContext): Promise<Journal> => (await request.get(`${API}/__journal`)).json();

async function capture(page: Page, nom: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/m3-${nom}.png` });
}

async function seConnecter(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('ecran-connexion')).toBeVisible();
  await page.getByTestId('champ-email').fill('accompagnant@demo.koudmen.test');
  await page.getByTestId('champ-mot-de-passe').fill('mot-de-passe-de-test');
  await page.getByTestId('bouton-connexion').click();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
  await expect(page.getByTestId('visite-vedette')).toContainText('Léonie');
}

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__reinitialiser`);
});

test('Kayé écrit hors ligne : gardé, puis envoyé au retour du réseau (une seule fois)', async ({ page, context, request }) => {
  await seConnecter(page);
  await expect(page.getByTestId('bandeau-hors-ligne')).toHaveCount(0);

  await page.getByTestId('ouvrir-visite-vedette').click();
  await page.getByTestId('bouton-ecrire-kaye').click();
  await expect(page.getByTestId('ecran-kaye-formulaire')).toBeVisible();

  // ── Coupure réseau ──
  await context.setOffline(true);
  await expect(page.getByTestId('indicateur-hors-ligne')).toHaveText('Hors ligne');

  await page.getByRole('radio', { name: 'Bien', exact: true }).click();
  await page.getByRole('radio', { name: 'Bon', exact: true }).click();
  await page.getByTestId('champ-note').fill(NOTE);
  await page.getByTestId('bouton-envoyer-kaye').click();

  await expect(page.getByTestId('kaye-garde')).toContainText('Pas de réseau. Le Kayé est gardé sur ce téléphone.');
  await expect(page.getByTestId('indicateur-hors-ligne')).toHaveText('Hors ligne · 1 envoi en attente');
  await capture(page, 'kaye-hors-ligne');

  // Double appui : toujours UN seul envoi en attente.
  await page.getByTestId('bouton-envoyer-kaye').click();
  await expect(page.getByTestId('kaye-garde')).toBeVisible();
  await expect(page.getByTestId('indicateur-hors-ligne')).toHaveText('Hors ligne · 1 envoi en attente');
  expect((await journal(request)).recus).toHaveLength(0);

  // ── Retour du réseau : la file part seule ──
  await context.setOffline(false);
  await expect(page.getByTestId('bandeau-hors-ligne')).toHaveCount(0, { timeout: 15_000 });
  await expect
    .poll(async () => (await journal(request)).traites.map((t) => `${t.type}:${t.statut}`), { timeout: 15_000 })
    .toEqual(['KAYE_PUBLICATION:ACCEPTE']);
  const j = await journal(request);
  expect(j.recus).toHaveLength(1);
  expect(j.recus[0]?.kaye?.note).toBe(NOTE);
  await capture(page, 'kaye-envoye-au-retour');
});

test('lecture hors ligne : visites du jour et fiche depuis le cache ; SOS sans réseau propose le 15 / 112', async ({ page, context, request }) => {
  await seConnecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await expect(page.getByTestId('ecran-fiche-visite')).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByTestId('indicateur-hors-ligne')).toHaveText('Hors ligne');

  // SOS : tentative immédiate, échec réseau → message + appels d'urgence.
  await page.getByTestId('bouton-sos').click();
  await page.getByTestId('bouton-envoyer-sos').click();
  const panneau = page.getByTestId('panneau-sos');
  await expect(panneau).toContainText('l’alerte n’est pas partie');
  await expect(panneau).toContainText('appelez le 15 ou le 112');
  await expect(panneau.getByTestId('appeler-15')).toBeVisible();
  await expect(panneau.getByTestId('appeler-112')).toBeVisible();
  await expect(page.getByTestId('indicateur-hors-ligne')).toHaveText('Hors ligne · 1 envoi en attente');
  await capture(page, 'sos-hors-ligne');
  await page.getByTestId('annuler-sos').click();

  // Retour à la liste (rechargée au retour sur l'écran) : relue depuis le cache, pas d'erreur.
  await page.goBack();
  await expect(page.getByTestId('ecran-visites')).toBeVisible();
  await expect(page.getByTestId('visite-vedette')).toContainText('Léonie');
  await expect(page.getByTestId('erreur-visites')).toHaveCount(0);
  // Fiche rouverte hors ligne : depuis le cache.
  await page.getByTestId('ouvrir-visite-vedette').click();
  await expect(page.getByTestId('ecran-fiche-visite')).toContainText('Marché de Rivière-Pilote');

  await context.setOffline(false);
  await expect
    .poll(async () => (await journal(request)).traites.map((t) => t.type), { timeout: 15_000 })
    .toEqual(['SOS']);
});
