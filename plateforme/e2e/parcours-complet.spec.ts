import { expect, test } from "@playwright/test";
import { cleanupE2E, createCaregiver, E2E_DOMAIN, E2E_PASSWORD, login, loginOperateur, prisma, uid } from "./fixtures";

/**
 * Parcours complet dans le MONDE RÉEL (hors bac à sable), flux D6 :
 *   1. La famille s'inscrit (code testeur), crée le profil de l'aîné (F2) et une demande (F6).
 *   2. L'opérateur propose le profil d'un accompagnant compatible à la famille (O5).
 *   3. La famille choisit ce profil (F5).
 *   4. L'accompagnant accepte (A5), fait le check-in (A7) et écrit le Kayé (A8).
 *   5. La famille lit le Kayé (F8).
 * Sélecteurs : rôles et libellés accessibles RÉELS des écrans livrés.
 */

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupE2E();
});
test.afterAll(async () => {
  await cleanupE2E();
  await prisma.$disconnect();
});

test("parcours complet : la famille demande, Koudmen propose, la famille choisit, l'accompagnant visite et écrit le Kayé, la famille le lit", async ({
  page,
  browser,
}) => {
  const id = uid();
  const aineFirstName = `Hortense${id.slice(-4)}`;
  const kayeNote = `Partie de dominos sous la véranda (e2e ${id}).`;

  // Accompagnante VALIDE à Saint-François, disponible tous les matins (compte e2e, mot de passe connu).
  const cg = await createCaregiver({
    firstName: "Rosette",
    status: "SALARIE_FAMILLE_CESU",
    validation: "VALIDE",
    communes: ["SAINT_FRANCOIS"],
    avail: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "MATIN"] as [number, "MATIN"]),
  });

  // ── 1. Famille : inscription, profil de l'aîné, demande ──
  const familyEmail = `famille-${id}@${E2E_DOMAIN}`;
  // L2 : inscription ouverte (plus de code testeur), puis connexion avec le mot de passe.
  await page.goto("/inscription?role=FAMILLE");
  await page.getByLabel("Prénom").fill("Annick");
  await page.locator("#lastName").fill(`Essai-${id.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]!)}`);
  await page.getByLabel("Adresse e-mail").fill(familyEmail);
  await page.getByLabel("Mot de passe").fill(E2E_PASSWORD);
  await page.getByLabel("J'habite").selectOption("HEXAGONE");
  await page.getByLabel(/J'accepte les conditions/).check();
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/inscription\/envoye/);
  await login(page, familyEmail);
  await expect(page).toHaveURL(/\/famille$/);

  await page.goto("/famille/aines/nouveau");
  await page.locator("#firstName").fill(aineFirstName);
  await page.getByLabel("Votre lien avec l'aîné").fill("fille");
  await page.getByLabel("Commune").selectOption("SAINT_FRANCOIS");
  await page.getByLabel("Compagnie", { exact: true }).check();
  await page.getByLabel(/Niveau 1 — Lien/).check();
  await page.getByLabel("Nom et prénom de l'aîné").fill(`${aineFirstName} E2E`);
  await page.getByLabel(/Je confirme l'accord/).check();
  await page.getByRole("button", { name: "Créer le profil" }).click();
  await expect(page).toHaveURL(/\/famille\/aines\/c[a-z0-9]+\?cree=1$/);
  await expect(page.getByText(aineFirstName).first()).toBeVisible();

  await page.goto("/famille/demandes/nouvelle");
  await page.getByLabel(/Niveau 1 — Lien/).check();
  await page.getByLabel("Une fois par semaine").check();
  await page.getByRole("checkbox", { name: "Mercredi, matin" }).check();
  await page.getByLabel("Nom de l'employeur (exemple)").fill(`${aineFirstName} E2E`);
  await page.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page).toHaveURL(/\/famille\/demandes\?envoyee=1$/);
  await expect(page.getByText("Demande envoyée.")).toBeVisible();
  await expect(page.getByText("Ouverte", { exact: true }).first()).toBeVisible();

  // ── 2. Opérateur : propose le profil de Rosette à la famille (D6) ──
  const operator = await browser.newPage();
  await loginOperateur(operator);
  await operator.goto("/operateur/demandes");
  await operator.getByRole("link", { name: new RegExp(aineFirstName) }).click();
  await operator.getByRole("button", { name: `Proposer ${cg.fullName} à la famille` }).click();
  await expect(operator.getByText(/proposé à la famille/).first()).toBeVisible();
  await operator.close();

  // ── 3. Famille : choisit le profil ──
  await page.goto("/famille/demandes");
  const profiles = page.getByRole("region", { name: `Profils proposés pour ${aineFirstName}` });
  await expect(profiles.getByRole("article", { name: /Rosette E\./ })).toBeVisible();
  await profiles.getByRole("button", { name: /Choisir Rosette E\./ }).click();
  await expect(page).toHaveURL(/choisi=/);
  await expect(page.getByText(/Vous avez choisi Rosette/).first()).toBeVisible();

  // ── 4. Accompagnant : accepte, check-in (position simulée + code), Kayé ──
  const caregiver = await browser.newPage();
  await login(caregiver, cg.user.email);
  await caregiver.goto("/accompagnant/propositions");
  const proposal = caregiver.getByRole("region", { name: new RegExp(aineFirstName) });
  await proposal.getByRole("button", { name: "Accepter" }).click();
  await expect(caregiver).toHaveURL(/\/accompagnant\/visites\?acceptee=\d+/);

  const visit = await prisma.visit.findFirstOrThrow({
    where: { caregiverId: cg.profile.id, aine: { firstName: aineFirstName } },
    orderBy: { scheduledStart: "asc" },
    include: { aine: { select: { homeCode: true } } },
  });
  await caregiver.goto(`/accompagnant/visites/${visit.id}`);
  await caregiver.getByRole("button", { name: "Simuler ma position au domicile" }).click();
  await expect(caregiver.getByText("Position enregistrée. Vous êtes au domicile.")).toBeVisible();
  await caregiver.getByLabel("Code à 6 caractères").fill(visit.aine.homeCode);
  await caregiver.getByRole("button", { name: "Valider le code" }).click();
  await expect(caregiver.getByText("Code correct. Preuve enregistrée.").first()).toBeVisible();
  await expect.poll(async () => (await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } })).status).toBe("VALIDEE");

  await caregiver.goto(`/accompagnant/visites/${visit.id}/kaye`);
  await caregiver.locator("main").getByText("Très bien", { exact: true }).click();
  await caregiver.locator("main").getByText("Bon", { exact: true }).click();
  await caregiver.getByLabel(/Note/).fill(kayeNote);
  await caregiver.getByRole("button", { name: "Envoyer le Kayé" }).click();
  await expect(caregiver).toHaveURL(/kaye\?envoye=1$/);
  await caregiver.close();

  // ── 5. Famille : lit le Kayé ──
  await page.goto("/famille/kaye");
  await expect(page.getByText(kayeNote)).toBeVisible();

  // Contrôles en base : mission (avec employeur), visite validée, Kayé notifié au cercle.
  const mission = await prisma.mission.findFirstOrThrow({ where: { caregiverId: cg.profile.id }, include: { visits: { include: { journal: true } } } });
  expect(mission.employerName).toBe(`${aineFirstName} E2E`);
  expect(mission.visits.some((v) => v.status === "VALIDEE" && v.journal)).toBe(true);
  expect(await prisma.outboxMessage.count({ where: { template: "KAYE_PUBLIE", relatedId: { in: mission.visits.map((v) => v.id) } } })).toBeGreaterThan(0);
});
