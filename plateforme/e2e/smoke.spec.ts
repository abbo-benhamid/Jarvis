import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, OPERATEUR_EMAIL, OPERATEUR_PASSWORD } from "./fixtures";

/**
 * Smoke tests S1b. Prérequis : base migrée + seedée, DEMO_MODE=true, TESTER_INVITE_CODES contient un code avec « E2E ».
 */
test("D13 + S1c : l'accueil vend la tranquillité, montre « Découvrir Koudmen » et le prix dans le premier écran, sans démo opérateur", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  // Maquette conso validée (écran a) : le titre dit la réponse ; la douleur « mwen bien » passe dans le chapeau.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("va bien");
  await expect(page.locator("main").getByText(/mwen bien/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce que vous recevez après une visite" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trois promesses" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Combien ça coûte ?" })).toBeVisible();
  const main = page.locator("main");
  // M1 : le bouton est dans le premier écran (360 × 640). Sur mobile, c'est celui du pied d'action collant (maquette écran a) ;
  // celui du héros est masqué sous 1024 px. Un seul des deux est visible à chaque largeur.
  const cta = main.getByTestId("cta-premier-ecran").filter({ visible: true });
  await expect(cta).toHaveAccessibleName("Découvrir Koudmen");
  await expect(cta).toBeInViewport();
  await expect(main.getByText("Tarifs de lancement :")).toBeVisible();
  // Les seuls boutons du contenu sont les « ? » du glossaire (A11) et les commandes d'animation (pause, « Revoir »).
  for (const b of await main.getByRole("button").all())
    await expect(b).toHaveAccessibleName(/Qu'est-ce que|Mettre l'animation en pause|Revoir l'animation des étapes/);
  await expect(page.getByText(/Opérateur/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Donner mon avis" })).toBeVisible();
  // Langage de lancement : plus de bandeau « Version de test » ni de « fictif » sur l'accueil ;
  // une ligne honnête dans le pied de page, avec le lien vers les mentions légales.
  await expect(page.getByText(/Version de test|fictif|Personnages inventés|Mode test/)).toHaveCount(0);
  const ouverture = page.getByTestId("ouverture");
  await expect(ouverture).toContainText("Koudmen ouvre bientôt en Martinique. Les visites ne sont pas encore proposées.");
  await expect(ouverture.getByRole("link", { name: "En savoir plus" })).toHaveAttribute("href", "/mentions-legales");
});

test("V2-web motion : le héros s'anime (pause possible) et le tutoriel joue jusqu'au Kayé, puis « Revoir »", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const hero = page.locator("figure.kd-scene");
  await expect(hero).toHaveAttribute("data-play", "true");
  const pause = page.getByRole("button", { name: "Mettre l'animation en pause" });
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(hero).toHaveAttribute("data-play", "false");
  await pause.click();
  await expect(hero).toHaveAttribute("data-play", "true");

  const scene = page.getByTestId("tutoriel-scene");
  await expect(scene).toHaveAttribute("data-stage", "0");
  await scene.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80));
  await expect(scene).toHaveAttribute("data-stage", "4", { timeout: 10_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Vous recevez le Kayé" })).toHaveAttribute("aria-current", "step");
  await expect(scene.getByText("2 preuves sur 3 · visite validée")).toBeVisible();
  await page.getByRole("button", { name: /Revoir/ }).click();
  await expect(scene).not.toHaveAttribute("data-stage", "4");
  await expect(scene).toHaveAttribute("data-stage", "4", { timeout: 10_000 });
});

test("V2-web motion : « réduire les animations » donne une page figée et complète", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("hero-kaye")).toContainText("Elle a bien mangé. Elle a ri en parlant du marché.");
  await expect(page.getByRole("button", { name: "Mettre l'animation en pause" })).toHaveCount(0);
  const scene = page.getByTestId("tutoriel-scene");
  await expect(scene).not.toHaveAttribute("data-stage");
  await expect(scene.getByText("2 preuves sur 3 · visite validée")).toBeVisible();
  await expect(scene.getByText(/carnaval de 1962/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Revoir/ })).toHaveCount(0);
});

test("D3 : toutes les pages sont en noindex", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const res = await request.get("/tester");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
});

test("D4 : mentions légales, confidentialité et CGU de la démo", async ({ page }) => {
  await page.goto("/mentions-legales");
  await expect(page.getByRole("heading", { level: 1, name: "Mentions légales" })).toBeVisible();
  await expect(page.getByText(/Vercel Inc\./)).toBeVisible();
  await page.goto("/confidentialite");
  await expect(page.getByRole("heading", { level: 1, name: "Politique de confidentialité" })).toBeVisible();
  // X7 : l'app mobile, le push (Expo), le stockage chiffré du téléphone. Ancre stable pour l'app.
  const app = page.locator("#application");
  await expect(app.getByRole("heading", { level: 2, name: "Application mobile Koudmen" })).toBeVisible();
  await expect(app).toContainText("Expo (650 Industries");
  await expect(app).toContainText("chiffrés");
  await expect(app).toContainText("Jamais le prénom de l'aîné");
  await page.goto("/cgu-test");
  await expect(page.getByRole("heading", { level: 1, name: "Conditions d'utilisation de la démo" })).toBeVisible();
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

test("inscription d'un accompagnant (CGU, date de naissance, mot de passe courant refusé) puis orientation", async ({ page }) => {
  const email = `e2e-${Date.now()}@exemple.test`;
  await page.goto("/inscription?role=ACCOMPAGNANT");
  await page.locator("#firstName").fill("Test");
  await page.locator("#lastName").fill("Accompagnant");
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("+596 696 11 22 33");
  await page.locator("#commune").selectOption("ROBERT");
  await page.locator("#birthDate").fill("1992-06-15");
  await page.getByLabel(/J'accepte les conditions/).check();
  // L1 : mot de passe trop courant → refus, et la saisie reste en place.
  await page.locator("#password").fill("Martinique972");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Ce mot de passe est trop courant. Choisissez-en un autre.").first()).toBeVisible();
  await expect(page.locator("#email")).toHaveValue(email);
  await page.locator("#password").fill("Lagon-Bleu-Robert-2026");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/inscription\/envoye\?role=ACCOMPAGNANT/);
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("Lagon-Bleu-Robert-2026");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/accompagnant/);
  await expect(page.getByTestId("etat-compte")).toContainText("Profil en cours de validation");
  await page.goto("/accompagnant/orientation");
  await expect(page).toHaveURL(/\/accompagnant\/orientation$/);
});

test("la route de purge refuse un appel sans CRON_SECRET", async ({ request }) => {
  const res = await request.get("/api/cron/purge-bacs-a-sable");
  expect(res.status()).toBe(401);
});
