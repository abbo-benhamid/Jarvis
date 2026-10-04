import { expect, test, type Page } from "@playwright/test";
import { cleanupE2E, createCaregiver, E2E_DOMAIN, E2E_PASSWORD, login, loginOperateur, prisma, uid } from "./fixtures";

/**
 * Parcours complet de bout en bout : famille → opérateur → accompagnant → famille.
 *
 *   1. La famille crée le profil de l'aîné (F2) et une demande (F6).
 *   2. L'opérateur propose un accompagnant compatible (O5).
 *   3. L'accompagnant accepte (A5), fait le check-in (A7) et écrit le Kayé (A8).
 *   4. La famille lit le Kayé (F8).
 *
 * Les écrans des lots A et B sont construits en parallèle. Tant qu'un écran affiche
 * « Écran en construction », le test est marqué `fixme` (ignoré, signalé dans le rapport).
 * Il s'active tout seul quand les lots sont fusionnés.
 * Sélecteurs : rôles et libellés accessibles seulement. [À VÉRIFIER] Ajuster les libellés
 * exacts après la fusion des lots A et B.
 */

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupE2E();
});
test.afterAll(async () => {
  await cleanupE2E();
  await prisma.$disconnect();
});

/** Ouvre un écran ; s'il est encore un squelette (PagePlaceholder), marque le test fixme. */
async function openScreen(page: Page, path: string, id: string) {
  await page.goto(path);
  const placeholder = await page.getByText("Écran en construction").isVisible();
  test.fixme(placeholder, `Écran ${id} (${path}) pas encore livré : parcours complet en attente de fusion des lots A et B.`);
}

test("parcours complet : la famille demande, l'opérateur propose, l'accompagnant visite et écrit le Kayé, la famille le lit", async ({
  page,
  browser,
}) => {
  const id = uid();
  const aineFirstName = `Hortense${id.slice(-4)}`;
  const kayeNote = `Partie de dominos sous la véranda (e2e ${id}).`;

  // Accompagnante VALIDE au François, disponible le mercredi matin (compte e2e, mot de passe connu).
  const cg = await createCaregiver({
    firstName: "Rosette",
    status: "SALARIE_FAMILLE_CESU",
    validation: "VALIDE",
    communes: ["FRANCOIS"],
    avail: [
      [0, "MATIN"],
      [1, "MATIN"],
      [2, "MATIN"],
      [3, "MATIN"],
      [4, "MATIN"],
      [5, "MATIN"],
      [6, "MATIN"],
    ],
  });

  // ── 1. Famille : inscription, profil de l'aîné, demande ──
  const familyEmail = `famille-${id}@${E2E_DOMAIN}`;
  await page.goto("/inscription?role=FAMILLE");
  await page.getByLabel("Prénom").fill("Annick");
  await page.locator("#lastName").fill(`E2E-${id}`);
  await page.getByLabel("Email").fill(familyEmail);
  await page.getByLabel("Mot de passe").fill(E2E_PASSWORD);
  await page.getByLabel("J'habite").selectOption("HEXAGONE");
  await page.getByLabel(/données fictives/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/famille$/);

  await openScreen(page, "/famille/aines/nouveau", "F2");
  await page.getByLabel(/^Prénom/).fill(aineFirstName);
  await page.getByLabel(/Commune/).selectOption("FRANCOIS");
  await page.getByLabel(/Niveau 1/).first().check();
  await page.getByLabel(/consent/i).first().check();
  await page.getByLabel(/Nom de la personne qui consent/i).fill(`${aineFirstName} E2E`);
  await page.getByRole("button", { name: /Créer|Enregistrer|Ajouter/ }).click();
  await expect(page.getByText(aineFirstName).first()).toBeVisible();

  await openScreen(page, "/famille/demandes/nouvelle", "F6");
  const aineSelect = page.getByLabel(/Aîné/);
  const aineValue = await aineSelect.locator("option", { hasText: aineFirstName }).getAttribute("value");
  await aineSelect.selectOption(aineValue ?? "");
  await page.getByLabel(/Fréquence/).selectOption("HEBDOMADAIRE");
  await page.getByRole("checkbox", { name: /Mercredi.*matin/i }).check();
  await page.getByRole("button", { name: /Envoyer|Créer|Enregistrer/ }).click();
  await expect(page.getByText(/Ouverte/).first()).toBeVisible();

  // ── 2. Opérateur : matching manuel ──
  const operator = await browser.newPage();
  await loginOperateur(operator);
  await operator.goto("/operateur/demandes");
  await operator.getByRole("link", { name: new RegExp(aineFirstName) }).click();
  await operator.getByRole("button", { name: `Proposer à ${cg.fullName}` }).click();
  await expect(operator.getByText("Proposition envoyée", { exact: true })).toBeVisible();
  await operator.close();

  // ── 3. Accompagnant : accepte, check-in, Kayé ──
  const caregiver = await browser.newPage();
  await login(caregiver, cg.user.email);
  await openScreen(caregiver, "/accompagnant/propositions", "A5");
  const proposal = caregiver.getByRole("article").filter({ hasText: aineFirstName });
  await proposal.getByRole("button", { name: /Accepter/ }).click();
  await expect(caregiver.getByText(/accept/i).first()).toBeVisible();

  await openScreen(caregiver, "/accompagnant/visites", "A6");
  await caregiver.getByRole("link", { name: new RegExp(aineFirstName) }).first().click();
  const aine = await prisma.aine.findFirstOrThrow({ where: { firstName: aineFirstName }, select: { homeCode: true } });
  await caregiver.getByRole("button", { name: /Simuler ma position au domicile/ }).click();
  await caregiver.getByLabel(/Code du domicile/i).fill(aine.homeCode);
  await caregiver.getByRole("button", { name: /Valider le code|Enregistrer le code|Valider/ }).first().click();
  await expect(caregiver.getByText(/Validée/).first()).toBeVisible();

  await caregiver.getByRole("link", { name: /Kayé/ }).first().click();
  await caregiver.getByLabel(/Bien/).first().check();
  const appetite = caregiver.getByRole("group", { name: /Appétit/ });
  if ((await appetite.count()) > 0) await appetite.getByLabel("Bon", { exact: true }).check();
  await caregiver.getByLabel(/Note/).first().fill(kayeNote);
  await caregiver.getByRole("button", { name: /Publier|Enregistrer|Envoyer/ }).click();
  await expect(caregiver.getByText(/Kayé/).first()).toBeVisible();
  await caregiver.close();

  // ── 4. Famille : lit le Kayé ──
  await openScreen(page, "/famille/kaye", "F8");
  await expect(page.getByText(kayeNote)).toBeVisible();

  // Contrôles en base : mission créée, visite validée, Kayé publié et notifié au cercle.
  const mission = await prisma.mission.findFirstOrThrow({ where: { caregiverId: cg.profile.id }, include: { visits: { include: { journal: true } } } });
  expect(mission.visits.some((v) => v.status === "VALIDEE" && v.journal)).toBe(true);
  expect(await prisma.outboxMessage.count({ where: { template: "KAYE_PUBLIE", relatedId: { in: mission.visits.map((v) => v.id) } } })).toBeGreaterThan(0);
});
