import { expect, test } from "@playwright/test";

/**
 * Smoke test S0 (Lot C l'étend). Prérequis : base migrée + seedée, DEMO_MODE=true.
 */
test("la page d'accueil affiche le mode démo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("veille sur nos aînés");
  await expect(page.getByRole("button", { name: "Essayer en tant que Famille" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Donner mon avis" })).toBeVisible();
});

for (const { role, label, home } of [
  { role: "Famille", label: "Essayer en tant que Famille", home: "/famille" },
  { role: "Accompagnant", label: "Essayer en tant qu'Accompagnant", home: "/accompagnant" },
  { role: "Opérateur", label: "Essayer en tant qu'Opérateur", home: "/operateur" },
]) {
  test(`connexion démo ${role}`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  });
}

test("un espace privé redirige vers la connexion sans session", async ({ page }) => {
  await page.goto("/operateur");
  await expect(page).toHaveURL(/\/connexion\?next=%2Foperateur/);
});

test("une famille ne peut pas ouvrir l'espace opérateur", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Essayer en tant que Famille" }).click();
  await expect(page).toHaveURL(/\/famille$/);
  await page.goto("/operateur");
  await expect(page).toHaveURL(/\/famille$/);
});

test("connexion par email et mot de passe", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill("operateur@demo.koudmen.test");
  await page.getByLabel("Mot de passe").fill("demo-koudmen-2026");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/operateur$/);
});

test("le bouton « Donner mon avis » enregistre un retour", async ({ page }) => {
  await page.goto("/mentions");
  await page.getByRole("button", { name: "Donner mon avis" }).click();
  const dialog = page.getByRole("dialog", { name: "Donner mon avis" });
  await dialog.getByText("Bien", { exact: true }).click();
  await dialog.getByLabel("Votre message").fill("Test e2e : la page des mentions est claire.");
  await dialog.getByRole("button", { name: "Envoyer mon avis" }).click();
  await expect(dialog.getByText("Merci !")).toBeVisible();
});

test("inscription d'un accompagnant puis orientation", async ({ page }) => {
  const email = `e2e-${Date.now()}@exemple.test`;
  await page.goto("/inscription?role=ACCOMPAGNANT");
  await page.getByLabel("Prénom").fill("Test");
  await page.locator("#lastName").fill("Accompagnant");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-e2e");
  await page.getByLabel(/données fictives/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/accompagnant\/orientation$/);
});
