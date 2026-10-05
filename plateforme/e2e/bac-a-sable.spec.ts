import { expect, test } from "@playwright/test";
import { cleanupE2E, E2E_TESTER_CODE, loginOperateur, prisma } from "./fixtures";

/**
 * Bac à sable (D2, D3, D14, D15) : entrée avec code → « Simuler la suite » → Kayé lu.
 * Vérifie aussi le cloisonnement : l'opérateur réel ne voit rien du bac à sable,
 * et le lien de reprise rouvre le test.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupE2E();
});
test.afterAll(async () => {
  await cleanupE2E();
  await prisma.$disconnect();
});

async function startSandbox(page: import("@playwright/test").Page, role: "Famille" | "Accompagnant", code = E2E_TESTER_CODE) {
  await page.goto("/");
  await page.getByRole("link", { name: "Tester Koudmen" }).first().click();
  await expect(page).toHaveURL(/\/tester$/);
  await page.getByLabel("Code testeur").fill(code);
  await page.getByLabel(new RegExp(`^${role} —`)).check();
  await page.getByLabel(/conditions d'utilisation du test/).check();
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel(/uniquement des données fictives/).check();
  await page.getByRole("button", { name: "Commencer le test" }).click();
}

test("un code inconnu est refusé", async ({ page }) => {
  await startSandbox(page, "Famille", "PAS-UN-CODE");
  await expect(page.getByText("Ce code testeur n'est pas valide.")).toBeVisible();
  await expect(page).toHaveURL(/\/tester$/);
});

test("famille : entrée avec code → Simuler la suite → choisir un profil → Kayé lu, sans fuite vers l'opérateur réel", async ({ page, browser }) => {
  await startSandbox(page, "Famille");
  await expect(page).toHaveURL(/\/famille\?bienvenue=1$/);
  const panel = page.getByRole("region", { name: /Votre test/ });
  await expect(panel).toBeVisible();
  // A8 : panneau compact (une ligne + prochaine étape) ; les scénarios sont repliés.
  await expect(panel.getByText(/Test 0\/10/)).toBeVisible();
  await expect(panel.getByText("1. Des nouvelles de Léonie")).toBeHidden();
  await panel.getByText("Voir les 3 scénarios et mon lien de reprise").click();
  await expect(panel.getByText("1. Des nouvelles de Léonie")).toBeVisible();
  await expect(page.getByText("Mode test", { exact: true })).toBeVisible();

  // Étape 1 : l'opérateur robot propose des profils (D6).
  await panel.getByRole("button", { name: "Simuler la suite" }).click();
  await expect(panel.getByText(/Koudmen vous propose 3 profils pour Léonie/)).toBeVisible();
  await panel.getByRole("link", { name: "Voir les profils" }).click();
  await expect(page).toHaveURL(/\/famille\/demandes$/);
  // D8 : le SAAD est une structure partenaire ; D7 : la proche aidante n'est pas proposée.
  const profiles = page.getByRole("region", { name: "Profils proposés pour Léonie" });
  await expect(profiles.getByRole("article", { name: /Structure partenaire/ })).toBeVisible();
  await expect(profiles.getByText(/Nadège/)).toHaveCount(0);

  // Sans choix de la famille, les robots attendent.
  await page.getByRole("region", { name: /Votre test/ }).getByRole("button", { name: "Simuler la suite" }).click();
  await expect(page.getByText(/À vous de jouer : choisissez un des profils/)).toBeVisible();

  // Étape 2 : la famille choisit.
  await profiles.getByRole("button", { name: /^Choisir Josiane L\./ }).click();
  await expect(page).toHaveURL(/choisi=/);

  // Étapes 3 et 4 : l'accompagnante robot accepte, puis fait la visite (preuve 2 sur 3) et publie le Kayé.
  const panel2 = page.getByRole("region", { name: /Votre test/ });
  await panel2.getByRole("button", { name: "Simuler la suite" }).click();
  await expect(panel2.getByText(/Josiane L\. accepte/)).toBeVisible();
  await panel2.getByRole("button", { name: "Simuler la suite" }).click();
  await expect(panel2.getByText(/2 preuves sur 3/)).toBeVisible();
  await panel2.getByRole("link", { name: "Lire le Kayé" }).click();
  await expect(page).toHaveURL(/\/famille\/kaye$/);
  await expect(page.getByText(/très en forme/).first()).toBeVisible();

  // D15 : micro-question après le Kayé, réponse enregistrée avec le code testeur.
  await page.getByRole("button", { name: "5 · Tout à fait" }).click();
  await expect(page.getByText("Merci ! Votre réponse aide l'équipe.")).toBeVisible();
  const sandbox = await prisma.sandbox.findFirstOrThrow({ where: { testerCode: E2E_TESTER_CODE, role: "FAMILLE" }, orderBy: { createdAt: "desc" } });
  expect(await prisma.microAnswer.count({ where: { sandboxId: sandbox.id, questionKey: "KAYE_RASSURE", answer: "5" } })).toBe(1);
  await expect.poll(() => prisma.usageEvent.count({ where: { sandboxId: sandbox.id, name: "page.view", path: "/famille/kaye" } })).toBeGreaterThan(0);

  // D15 : offre factice avec consentement explicite.
  await page.goto("/famille/visite-decouverte");
  await page.getByLabel("Votre prénom").fill("Nadia");
  await page.getByLabel("Votre email ou votre téléphone").fill("nadia.e2e@exemple.test");
  await page.getByRole("button", { name: "Être recontacté(e)" }).click();
  await expect(page.getByText(/Cochez la case/)).toBeVisible();
  await page.getByLabel(/J'accepte que Koudmen garde mon prénom/).check();
  await page.getByRole("button", { name: "Être recontacté(e)" }).click();
  await expect(page.getByText("Merci ! Koudmen est en test : nous vous recontacterons.")).toBeVisible();

  // Cloisonnement (D2) : l'opérateur réel ne voit ni l'aînée ni les accompagnants du bac à sable,
  // mais il voit la mesure (D15).
  const sandboxRequests = await prisma.careRequest.findMany({ where: { aine: { sandboxId: sandbox.id } }, select: { id: true } });
  const sandboxCaregivers = await prisma.caregiverProfile.findMany({ where: { user: { sandboxId: sandbox.id } }, select: { id: true } });
  expect(sandboxRequests.length).toBeGreaterThan(0);
  const op = await browser.newPage();
  await loginOperateur(op);
  await op.goto("/operateur/demandes");
  for (const r of sandboxRequests) await expect(op.locator(`a[href="/operateur/demandes/${r.id}"]`)).toHaveCount(0);
  await op.goto("/operateur/accompagnants");
  for (const c of sandboxCaregivers) await expect(op.locator(`a[href="/operateur/accompagnants/${c.id}"]`)).toHaveCount(0);
  // Accès direct par URL : introuvable.
  await op.goto(`/operateur/demandes/${sandboxRequests[0]!.id}`);
  await expect(op.getByText(/introuvable|n'existe pas|404/i).first()).toBeVisible();
  await op.goto("/operateur/test");
  await expect(op.getByRole("heading", { level: 1, name: "Mesure du test" })).toBeVisible();
  await expect(op.getByText("nadia.e2e@exemple.test")).toBeVisible();
  await op.close();

  // M6 : retrait du consentement par le lien donné une fois après l'envoi (sans compte, autre appareil).
  const withdrawLink = await page.getByLabel("Lien pour retirer votre accord").inputValue();
  expect(withdrawLink).toMatch(/\/retrait-accord\/[A-Za-z0-9_-]{20,}$/);
  const other = await browser.newPage();
  await other.goto(new URL(withdrawLink).pathname);
  await other.getByRole("button", { name: "Retirer mon accord et effacer mon contact" }).click();
  await expect(other.getByText(/Votre accord est retiré/)).toBeVisible();
  expect(await prisma.discoveryRequest.count({ where: { contact: "nadia.e2e@exemple.test" } })).toBe(0);
  // Deuxième clic sur le même lien : plus rien à effacer.
  await other.reload();
  await other.getByRole("button", { name: "Retirer mon accord et effacer mon contact" }).click();
  await expect(other.getByText(/n'est plus valable/)).toBeVisible();
  await other.close();
});

test("le lien de reprise rouvre le bac à sable sur un autre appareil", async ({ page, browser }) => {
  await startSandbox(page, "Accompagnant");
  await expect(page).toHaveURL(/\/accompagnant\?bienvenue=1$/);
  await page.getByText("Voir les 3 scénarios et mon lien de reprise").click();
  const link = await page.getByLabel("Lien de reprise de votre test").inputValue();
  const path = new URL(link).pathname;
  expect(path).toMatch(/^\/tester\/reprendre\/[A-Za-z0-9_-]{40,}$/);

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(path);
  await expect(p2).toHaveURL(/\/accompagnant$/);
  await p2.getByRole("button", { name: "Simuler la suite" }).click();
  await expect(p2.getByText(/répondez aux 5 questions/)).toBeVisible();
  await other.close();

  // Un compte de bac à sable n'ouvre jamais l'espace opérateur.
  await page.goto("/operateur");
  await expect(page).toHaveURL(/\/accompagnant$/);

  // M3 + M7 : la déconnexion efface les DEUX cookies et révoque le jeton déjà émis.
  const before = await page.context().cookies();
  const session = before.find((c) => c.name === "koudmen_session")!;
  expect(before.some((c) => c.name === "koudmen_bac_a_sable")).toBe(true);
  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  const names = (await page.context().cookies()).map((c) => c.name);
  expect(names).not.toContain("koudmen_session");
  expect(names).not.toContain("koudmen_bac_a_sable");
  // Le jeton copié avant la déconnexion ne sert plus (appareil volé, cookie copié).
  const replay = await browser.newContext();
  await replay.addCookies([session]);
  const p3 = await replay.newPage();
  await p3.goto("/accompagnant");
  await expect(p3).toHaveURL(/\/connexion/);
  await replay.close();
  // Le lien de reprise, lui, rouvre toujours le test (nouvelle session).
  await page.goto(path);
  await expect(page).toHaveURL(/\/accompagnant$/);
});
