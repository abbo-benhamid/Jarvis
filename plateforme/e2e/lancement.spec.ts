/**
 * L1-A : MODE LANCEMENT (serveur dédié, KOUDMEN_MODE=lancement, sans BREVO_API_KEY).
 * - Démo, bac à sable et offre factice fermés.
 * - Inscription ouverte, e-mails capturés (adaptateur console + MAIL_CAPTURE_FILE), lien de vérification,
 *   mot de passe oublié, « Profil en cours de validation ».
 * - Préinscription (R1) : pas de fiche aîné ; demande de rappel (L4) visible chez l'opérateur.
 * Comptes @e2e.koudmen.test : effacés par cleanupE2E().
 */
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { cleanupE2E, E2E_DOMAIN, login, loginOperateur, uid } from "./fixtures";

const PASSWORD = "Zebre-Lagon-2026";

test.beforeAll(cleanupE2E);
test.afterAll(cleanupE2E);

/** Dernier e-mail capturé pour une adresse et un modèle ; renvoie le chemin du lien (sans le domaine de APP_URL). */
async function mailLink(to: string, template: string): Promise<string> {
  const file = process.env.E2E_MAIL_CAPTURE_FILE!;
  let found: string | null = null;
  await expect
    .poll(() => {
      if (!existsSync(file)) return null;
      const mails = readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { to: string; template: string; text: string })
        .filter((m) => m.to === to && m.template === template);
      const m = mails.at(-1);
      const url = m ? /https?:\/\/[^\s]+jeton=[^\s]+/.exec(m.text)?.[0] : undefined;
      found = url ? new URL(url).pathname + new URL(url).search : null;
      return found;
    }, { timeout: 10_000 })
    .not.toBeNull();
  return found!;
}

async function register(page: Page, role: "FAMILLE" | "ACCOMPAGNANT", email: string) {
  await page.goto("/inscription");
  await page.getByLabel(role === "FAMILLE" ? /^Famille/ : /^Accompagnant/).check();
  await page.locator("#firstName").fill("Rose");
  await page.locator("#lastName").fill(`E2E-${uid()}`);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.locator("#phone").fill("+596 696 12 34 56");
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  if (role === "ACCOMPAGNANT") {
    await page.locator("#commune").selectOption("FORT_DE_FRANCE");
    await page.locator("#birthDate").fill("1990-04-02");
  } else {
    await page.locator("#location").selectOption("HEXAGONE");
    await page.locator("#adult").check();
  }
  await page.getByLabel(/J'accepte les conditions/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/inscription\/envoye/);
  await expect(page.getByRole("heading", { level: 1, name: "Vérifiez votre boîte mail" })).toBeVisible();
}

test("L1 : démo, bac à sable et offre factice fermés ; accueil « Créer un compte »", async ({ page, request }) => {
  for (const [from, to] of [
    ["/tester", "/inscription"],
    ["/tester/design", "/inscription"],
    ["/cgu-test", "/cgu"],
  ] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  }
  expect((await request.get("/tester/reprendre/abc", { maxRedirects: 0 })).status()).toBe(307);
  await page.goto("/");
  await expect(page.getByTestId("cta-premier-ecran").first()).toHaveAttribute("href", "/inscription");
  await expect(page.locator('a[href="/tester"]')).toHaveCount(0);
  await expect(page.getByTestId("ouverture")).toContainText("Koudmen n'est pas un service d'aide à domicile autorisé.");
  await page.goto("/connexion");
  await expect(page.getByText(/Démonstration en direct|Démo partagée/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mot de passe oublié ?" })).toBeVisible();
  await page.goto("/cgu");
  await expect(page.getByRole("heading", { level: 1, name: "Conditions d'utilisation" })).toBeVisible();
  await page.goto("/conditions-accompagnants");
  await expect(page.getByText("L'inscription et l'usage de Koudmen sont gratuits pour vous.")).toBeVisible();
  await page.goto("/confidentialite");
  await expect(page.getByText(/code testeur|bac à sable/i)).toHaveCount(0);
});

test("L1 : /api/sante (mode, avertissement Brevo, préinscription) ; API v1 : démo refusée, inscription sans fuite", async ({ request }) => {
  const sante = await (await request.get("/api/sante")).json();
  expect(sante.mode).toBe("lancement");
  expect(sante.donneesReelles).toContain("preinscription");
  expect(sante.avertissements.join(" ")).toContain("BREVO_API_KEY absente");

  const demo = await request.post("/api/v1/auth/code", { data: { methode: "demo", role: "ACCOMPAGNANT", codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" } });
  expect(demo.status()).toBe(403);
  expect((await demo.json()).erreur.code).toBe("ACCES_REFUSE");

  const email = `api-${uid()}@${E2E_DOMAIN}`;
  const body = { role: "ACCOMPAGNANT", prenom: "Api", nom: `E2E-${uid()}`, email, telephone: "+596 696 00 00 01", motDePasse: PASSWORD, commune: "LAMENTIN", dateNaissance: "1995-01-15", accepteCgu: true };
  const first = await request.post("/api/v1/auth/inscription", { data: body });
  const again = await request.post("/api/v1/auth/inscription", { data: { ...body, prenom: "Autre" } });
  expect(first.status()).toBe(201);
  expect(again.status()).toBe(201);
  expect(await again.json()).toEqual(await first.json());
  const young = await request.post("/api/v1/auth/inscription", { data: { ...body, email: `jeune-${uid()}@${E2E_DOMAIN}`, dateNaissance: "2015-01-01" } });
  expect(young.status()).toBe(422);
  const forgot = await request.post("/api/v1/auth/mot-de-passe-oublie", { data: { email: `inconnu-${uid()}@${E2E_DOMAIN}` } });
  expect(forgot.status()).toBe(202);
});

test("L2 / L3 : accompagnant — inscription, connexion tout de suite, « Profil en cours de validation », lien de vérification", async ({ page }) => {
  const email = `accompagnant-l1-${uid()}@${E2E_DOMAIN}`;
  await register(page, "ACCOMPAGNANT", email);
  await login(page, email, PASSWORD);
  const etat = page.getByTestId("etat-compte");
  await expect(etat).toContainText("Confirmez votre adresse e-mail");
  await expect(etat).toContainText("Profil en cours de validation");

  await page.goto(await mailLink(email, "VERIFICATION_EMAIL"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page).toHaveURL(/\/accompagnant/);
  await expect(page.getByTestId("etat-compte")).not.toContainText("Confirmez votre adresse e-mail");
  await expect(page.getByTestId("etat-compte")).toContainText("Profil en cours de validation");
});

test("L3 : mot de passe oublié → nouveau mot de passe → l'ancien ne marche plus ; le lien sert une fois", async ({ page }) => {
  const email = `famille-mdp-${uid()}@${E2E_DOMAIN}`;
  await register(page, "FAMILLE", email);
  await page.goto("/mot-de-passe-oublie");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir un lien" }).click();
  await expect(page.getByText(/Si un compte existe avec cette adresse/)).toBeVisible();
  const link = await mailLink(email, "MOT_DE_PASSE_OUBLIE");
  await page.goto(link);
  await page.getByLabel("Nouveau mot de passe").fill("Nouveau-Manguier-2027");
  await page.getByLabel("Confirmez le mot de passe").fill("Nouveau-Manguier-2027");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/connexion\?info=mot-de-passe-change/);
  await page.goto(link);
  await expect(page.getByText("Ce lien ne marche plus.")).toBeVisible();
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
  await login(page, email, "Nouveau-Manguier-2027");
  await expect(page).toHaveURL(/\/famille/);
});

test("R1 / L4 : préinscription — pas de fiche aîné ; demande de rappel visible chez l'opérateur ; aucun paiement", async ({ page }) => {
  const email = `famille-rappel-${uid()}@${E2E_DOMAIN}`;
  await register(page, "FAMILLE", email);
  await login(page, email, PASSWORD);
  await expect(page.getByText("Koudmen ouvre bientôt. Nous vous contactons dès l'ouverture.")).toBeVisible();
  await page.goto("/famille/aines/nouveau");
  await expect(page.getByText("Koudmen ouvre bientôt. Nous vous contactons dès l'ouverture.")).toBeVisible();
  await expect(page.getByLabel("Prénom")).toHaveCount(0);
  await page.goto("/famille/formule");
  await expect(page.getByText(/simulé/)).toHaveCount(0);
  await expect(page.getByText("Non éligible au crédit d'impôt.", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Être appelé pour Sérénité" }).click();
  await expect(page.getByText(/Demande envoyée pour la formule Sérénité/)).toBeVisible();
  await page.goto("/famille/visite-decouverte");
  await expect(page).toHaveURL(/\/famille\/formule$/);

  await page.context().clearCookies();
  await loginOperateur(page);
  await page.goto("/operateur/activations");
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.getByText("À appeler").first()).toBeVisible();
  await page.goto("/operateur/comptes");
  await expect(page.getByText(email)).toBeVisible();
  await page.goto("/operateur/test");
  await expect(page).toHaveURL(/\/operateur$/);
});
