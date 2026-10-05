import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, E2E_TESTER_CODE, OPERATEUR_EMAIL, OPERATEUR_PASSWORD } from "./fixtures";

/**
 * Smoke tests S1b. Prérequis : base migrée + seedée, DEMO_MODE=true, TESTER_INVITE_CODES contient un code avec « E2E ».
 */
test("D13 + S1c : l'accueil vend la tranquillité, montre « Tester Koudmen » et le prix dans le premier écran, sans démo opérateur", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  // Maquette conso validée (écran a) : le titre dit la réponse ; la douleur « mwen bien » passe dans le chapeau.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("va bien");
  await expect(page.locator("main").getByText(/mwen bien/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce que vous recevez après une visite" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trois promesses" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Combien ça coûte ?" })).toBeVisible();
  const main = page.locator("main");
  // M1 : le bouton est dans le premier écran (360 × 640).
  await expect(main.getByRole("link", { name: "Tester Koudmen" }).first()).toBeInViewport();
  await expect(main.getByText(/Prix en test/)).toBeVisible();
  // Les seuls boutons du contenu sont les « ? » du glossaire (A11).
  for (const b of await main.getByRole("button").all()) await expect(b).toHaveAccessibleName(/Qu'est-ce que/);
  await expect(page.getByText(/Opérateur/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Donner mon avis" })).toBeVisible();
  // T9 : bandeau de test présent.
  await expect(page.getByRole("note")).toContainText("Version de test");
});

test("D3 : toutes les pages sont en noindex", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const res = await request.get("/tester");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
});

test("D4 : mentions légales, confidentialité et CGU de test", async ({ page }) => {
  await page.goto("/mentions-legales");
  await expect(page.getByRole("heading", { level: 1, name: "Mentions légales" })).toBeVisible();
  await expect(page.getByText(/Vercel Inc\./)).toBeVisible();
  await page.goto("/confidentialite");
  await expect(page.getByRole("heading", { level: 1, name: "Politique de confidentialité" })).toBeVisible();
  await page.goto("/cgu-test");
  await expect(page.getByRole("heading", { level: 1, name: "Conditions d'utilisation du test" })).toBeVisible();
  await page.goto("/mentions");
  await expect(page).toHaveURL(/\/mentions-legales$/);
});

for (const { role, label, home } of [
  { role: "Famille", label: "Démo partagée : Famille", home: "/famille" },
  { role: "Accompagnant", label: "Démo partagée : Accompagnant", home: "/accompagnant" },
]) {
  test(`démo partagée ${role} (DEMO_MODE=true, page de connexion)`, async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByText(/Compte partagé/)).toBeVisible();
    await page.getByRole("button", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  });
}

test("D1 : aucune démo opérateur", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("button", { name: /Opérateur/ })).toHaveCount(0);
});

test("un espace privé redirige vers la connexion sans session", async ({ page }) => {
  await page.goto("/operateur");
  await expect(page).toHaveURL(/\/connexion\?next=%2Foperateur/);
});

test("une famille ne peut pas ouvrir l'espace opérateur", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Démo partagée : Famille" }).click();
  await expect(page).toHaveURL(/\/famille$/);
  await page.goto("/operateur");
  await expect(page).toHaveURL(/\/famille$/);
});

test("connexion d'un vrai opérateur par email et mot de passe", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(OPERATEUR_EMAIL);
  await page.getByLabel("Mot de passe").fill(OPERATEUR_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/operateur$/);
});

test("une erreur de connexion garde l'email saisi (pas de remise à zéro)", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill("famille@demo.koudmen.test");
  await page.getByLabel("Mot de passe").fill(`${DEMO_PASSWORD}-faux`);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("famille@demo.koudmen.test");
});

test("le bouton « Donner mon avis » enregistre un retour", async ({ page }) => {
  await page.goto("/mentions-legales");
  await page.getByRole("button", { name: "Donner mon avis" }).click();
  const dialog = page.getByRole("dialog", { name: "Donner mon avis" });
  await dialog.getByText("Bien", { exact: true }).click();
  await dialog.getByLabel("Votre message").fill("Test e2e : la page des mentions est claire.");
  await dialog.getByRole("button", { name: "Envoyer mon avis" }).click();
  await expect(dialog.getByText("Merci !")).toBeVisible();
});

test("inscription d'un accompagnant (code testeur, CGU, âge) puis orientation", async ({ page }) => {
  const email = `e2e-${Date.now()}@exemple.test`;
  await page.goto("/inscription?role=ACCOMPAGNANT");
  await page.getByLabel("Prénom").fill("Test");
  await page.locator("#lastName").fill("Accompagnant");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-e2e");
  await page.getByLabel(/données fictives/).check();
  await page.getByLabel(/conditions d'utilisation du test/).check();
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  // Code faux : refus, et la saisie reste en place.
  await page.getByLabel("Code testeur").fill("CODE-INCONNU");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Ce code testeur n'est pas valide.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("Code testeur").fill(E2E_TESTER_CODE);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/accompagnant\/orientation$/);
});

test("la route de purge refuse un appel sans CRON_SECRET", async ({ request }) => {
  const res = await request.get("/api/cron/purge-bacs-a-sable");
  expect(res.status()).toBe(401);
});
