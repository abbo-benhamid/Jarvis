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
import { cleanupE2E, createCaregiver, E2E_DOMAIN, login, loginOperateur, uid } from "./fixtures";

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
  await page.locator("#lastName").fill(`Essai-${uid().replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]!)}`);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.locator("#phone").fill("+590 690 12 34 56");
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  if (role === "ACCOMPAGNANT") {
    await page.locator("#commune").selectOption("POINTE_A_PITRE");
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

test("L1d (M2) : aucune marque [À VÉRIFIER] ni texte de démonstration sur les pages légales publiques", async ({ page }) => {
  for (const path of ["/confidentialite", "/mentions-legales", "/cgu", "/conditions-accompagnants"]) {
    await page.goto(path);
    await expect(page.locator("main")).not.toContainText("VÉRIFIER");
    await expect(page.locator("main")).not.toContainText(/simulé|testeurs invités|Ce site est une démo/);
  }
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
  const body = { role: "ACCOMPAGNANT", prenom: "Api", nom: `Essai-${uid().replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]!)}`, email, telephone: "+590 690 00 00 01", motDePasse: PASSWORD, commune: "ABYMES", dateNaissance: "1995-01-15", accepteCgu: true };
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
  await expect(page.getByTestId("place-liste")).toContainText("sur la liste d'ouverture en Guadeloupe");
  await page.goto("/famille/aines/nouveau");
  await expect(page.getByText("Koudmen ouvre bientôt. Nous vous contactons dès l'ouverture.")).toBeVisible();
  await expect(page.getByLabel("Prénom")).toHaveCount(0);
  await page.goto("/famille/formule");
  await expect(page.getByText(/simulé/)).toHaveCount(0);
  await expect(page.getByText("Non éligible au crédit d'impôt.", { exact: false }).first()).toBeVisible();
  // L1d (M4) : numéro obligatoire (prérempli), créneau avec l'heure de Paris, aucune formule nécessaire pour une question.
  await expect(page.getByRole("button", { name: "Demander un appel pour poser une question" })).toBeVisible();
  await page.getByRole("button", { name: "Demander un appel pour la formule Sérénité" }).click();
  const form = page.getByRole("form", { name: "Demander un appel pour la formule Sérénité" });
  await expect(form.getByLabel("Numéro où le conseiller vous appelle")).toHaveValue("+590 690 12 34 56");
  await form.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(form.getByText("Choisissez un créneau.")).toBeVisible();
  await form.getByLabel(/^8 h – 11 h en Guadeloupe \(1[34] h – 1[67] h à Paris\)$/).check();
  await form.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.getByText(/Demande envoyée pour la formule Sérénité/)).toBeVisible();
  // L1d (M3) : préinscription sans impasse « Ajouter un aîné » ; barre réduite à Accueil et Formule.
  await page.goto("/famille/kaye");
  await expect(page.getByText("Cette page s'ouvre au lancement de Koudmen.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajouter un aîné" })).toHaveCount(0);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Visites" })).toHaveCount(0);
  await page.goto("/famille");
  await expect(page.getByTestId("etat-appel")).toContainText(/Demande envoyée le/);
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

test("L2 : en lancement, les services simulés sont fermés (page et webhook simulés absents, avertissements dans /api/sante)", async ({ request }) => {
  expect((await request.get("/verification/simulee?session=sim_abcdefghijkl")).status()).toBe(404);
  expect((await request.post("/api/webhooks/identite/simule", { data: {} })).status()).toBe(404);
  const sante = await (await request.get("/api/sante")).json();
  expect(sante.verifications.identite).toEqual({ adaptateur: "simule", ouvert: false });
  expect(sante.verifications.sms.ouvert).toBe(false);
  expect(sante.avertissements.join(" ")).toMatch(/ADAPTER_IDENTITY=simule en lancement/);
});

/** P1 : rien de « test », « fictif » ou « démo » dans ce que lit la famille ; aucune marque interne. */
async function expectPublicWording(page: Page, testId: string) {
  const text = (await page.getByTestId(testId).innerText()).toLowerCase();
  expect(text).not.toMatch(/\btest\b|fictif|fictive|démo|vérifier\]/);
}

test("P1 : préinscription famille — place sur la liste, appel, visite guidée, liste locale, invitation", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const email = `famille-p1-${uid()}@${E2E_DOMAIN}`;
  await register(page, "FAMILLE", email);
  await login(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/famille$/);

  // 1. Place sur la liste d'ouverture et date visée (OUVERTURE_PREVUE du serveur de lancement).
  const place = page.getByTestId("place-liste");
  await expect(place.getByRole("heading", { level: 2 })).toHaveText(/^Vous êtes n°\s\d+ sur la liste d'ouverture en Guadeloupe\.$/);
  await expect(page.getByTestId("ouverture-prevue")).toContainText(/Ouverture (prévue en \S+ \d{4}|: bientôt)\./);
  await expect(page.getByTestId("prochaine-etape")).toHaveText("Parlez à un conseiller : il répond à vos questions.");
  await expectPublicWording(page, "place-liste");

  // 2. « Préparer l'arrivée » : gardé sur l'appareil (localStorage), après rechargement.
  await expect(page.getByTestId("preparer-avancement")).toHaveText("0 sur 5 prêt");
  await page.getByLabel(/Parlez de Koudmen à votre parent/).check();
  await page.getByLabel(/Gardez le numéro de votre parent/).check();
  await expect(page.getByTestId("preparer-avancement")).toHaveText("2 sur 5 prêts");
  await page.reload();
  await expect(page.getByTestId("preparer-avancement")).toHaveText("2 sur 5 prêts");
  await expect(page.getByLabel(/Parlez de Koudmen à votre parent/)).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("koudmen.preparer-arrivee.v1"))).toBe('["accord","telephone"]');

  // 3. « Inviter un proche » : lien d'inscription au site, copie ; aucun champ e-mail.
  await expect(page.getByTestId("lien-invitation")).toHaveText(/\/inscription$/);
  await expect(page.locator("#inviter input[type=email]")).toHaveCount(0);
  await page.getByRole("button", { name: /Copier/ }).click();
  await expect(page.getByText("Le lien est copié. Collez-le dans un message.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/inscription$/);

  // 4. Demande d'appel depuis l'accueil, puis son état.
  await page.getByRole("button", { name: "Demander un appel" }).click();
  const form = page.getByRole("form", { name: "Demander un appel" });
  await form.getByLabel(/^8 h – 11 h en Guadeloupe/).check();
  await form.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.getByText(/Demande envoyée/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("etat-appel")).toContainText(/Demande envoyée le \d/);
  await expect(page.getByTestId("etat-appel")).toContainText("Un conseiller vous appelle sur votre créneau : 8 h – 11 h en Guadeloupe");
  await expect(page.getByTestId("prochaine-etape")).toHaveText("Un conseiller vous appelle sur votre créneau.");

  // 5. « Découvrir Koudmen » : 5 écrans, exemples statiques, prix sur deux lignes.
  await page.getByTestId("lien-decouvrir").click();
  await expect(page).toHaveURL(/\/famille\/decouvrir$/);
  const tour = page.getByTestId("visite-guidee");
  await expect(page.getByTestId("visite-position")).toHaveText("Écran 1 sur 5");
  await expect(page.getByRole("heading", { level: 2, name: "Après chaque visite, des nouvelles" })).toBeVisible();
  await expect(tour.locator('[data-ecran="kaye"]').getByText("Exemple", { exact: true })).toBeVisible();
  await expectPublicWording(page, "visite-guidee");
  const titles = ["Vous savez quand l'accompagnant arrive", "Une carte chez votre parent prouve chaque visite", "Trois formules, sans surprise", "Trois étapes jusqu'à la première visite"];
  for (const [i, title] of titles.entries()) {
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByTestId("visite-position")).toHaveText(`Écran ${i + 2} sur 5`);
    const h = page.getByRole("heading", { level: 2, name: title });
    await expect(h).toBeVisible();
    await expect(h).toBeFocused();
    await expectPublicWording(page, "visite-guidee");
    if (i === 1) await expect(tour.getByRole("img", { name: /QR code signé du domicile/ })).toBeVisible();
    if (i === 2) {
      await expect(tour.getByText("Abonnement Koudmen : 39 € TTC par mois. Services numériques. Non éligible au crédit d'impôt.")).toBeVisible();
      await expect(tour.getByText("Heures d'accompagnement : payées à part à l'accompagnant. Crédit d'impôt de 50 % si les conditions sont remplies.").first()).toBeVisible();
    }
  }
  await expect(page.getByRole("button", { name: "Suivant" })).toHaveCount(0);
  await page.getByRole("button", { name: "Précédent" }).click();
  await expect(page.getByTestId("visite-position")).toHaveText("Écran 4 sur 5");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("link", { name: "Préparer l'arrivée" }).click();
  await expect(page).toHaveURL(/\/famille#preparer$/);
  await expect(page.getByTestId("preparer-avancement")).toHaveText("2 sur 5 prêts");
});

test("P1 : préinscription accompagnant — file de validation, étapes, « Découvrir le métier »", async ({ page }) => {
  // Nouveau compte : pas encore dans la file.
  const email = `accompagnant-p1-${uid()}@${E2E_DOMAIN}`;
  await register(page, "ACCOMPAGNANT", email);
  await login(page, email, PASSWORD);
  await expect(page.getByTestId("place-file")).toContainText("Pas encore dans la file de validation");
  await expect(page.getByRole("heading", { name: /^Votre parcours · 0 sur \d+$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Répondre aux 5 questions" })).toBeVisible();

  // Dossier envoyé : place dans la file, revenus calculés avec le tarif du profil.
  await page.context().clearCookies();
  const g = await createCaregiver({ firstName: "Murielle", status: "AUTO_ENTREPRENEUR_SAP", validation: "EN_ATTENTE", communes: ["SAINTE_ANNE"], avail: [[1, "MATIN"]] });
  await login(page, g.user.email);
  await expect(page.getByTestId("place-file").getByRole("heading", { level: 2 })).toHaveText(/^Vous êtes n°\s\d+ dans la file de validation\.$/);
  await expect(page.getByTestId("place-file")).toContainText("Réponse en 7 jours au plus.");
  await page.getByTestId("lien-metier").click();
  await expect(page).toHaveURL(/\/accompagnant\/decouvrir$/);
  await expect(page.getByTestId("visite-position")).toHaveText("Écran 1 sur 4");
  await expect(page.getByRole("heading", { level: 2, name: "Des visites près de chez vous" })).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByTestId("revenus-indicatifs")).toContainText("Revenu net estimé");
  await expect(page.getByTestId("revenus-indicatifs")).toContainText(/15,00\s€ de l'heure/);
  await expect(page.getByTestId("visite-guidee")).not.toContainText("VÉRIFIER");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("link", { name: "Voir mon parcours" }).click();
  await expect(page).toHaveURL(/\/accompagnant$/);
});
