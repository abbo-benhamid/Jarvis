import { expect, test } from "@playwright/test";
import {
  cleanupE2E,
  createCaregiver,
  createFamilyWithAine,
  createRequest,
  createVisitToCheck,
  FEEDBACK_MARK,
  login,
  loginOperateur,
  operatorId,
  prisma,
  uid,
} from "./fixtures";

/**
 * Parcours de l'opérateur (écrans O1 à O9). Données e2e isolées, effacées à la fin.
 * Sélecteurs par rôle et libellé accessibles.
 */

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupE2E();
});
test.afterAll(async () => {
  await cleanupE2E();
  await prisma.$disconnect();
});

test("O1 — le tableau de bord montre ce qui demande une action", async ({ page }) => {
  await loginOperateur(page);
  await expect(page).toHaveURL(/\/operateur$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  for (const name of [
    /Accompagnants à vérifier/,
    /Demandes à matcher/,
    /Visites à vérifier/,
    /Kayé « à surveiller »/,
    /Retours testeurs non lus/,
  ]) {
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  }
  // Le seed contient Steeve EN_ATTENTE : le compteur est non nul et mène à la liste filtrée.
  await page.getByRole("link", { name: /^Accompagnants à vérifier/ }).click();
  await expect(page).toHaveURL(/\/operateur\/accompagnants\?validation=EN_ATTENTE/);
  await expect(page.getByLabel("Vérification")).toHaveValue("EN_ATTENTE");
});

test("O2/O3 — valider un accompagnant : revue de chaque vérification, motif obligatoire pour refuser, puis suspension", async ({
  page,
}) => {
  const cg = await createCaregiver({
    firstName: "Candidat",
    status: "SALARIE_FAMILLE_CESU",
    validation: "EN_ATTENTE",
    communes: ["ROBERT"],
    avail: [[2, "MATIN"]],
    verifications: ["IDENTITE", "CASIER_B3", "DIPLOME"],
  });
  await loginOperateur(page);
  await page.goto("/operateur/accompagnants?validation=EN_ATTENTE");
  await page.getByRole("link", { name: cg.fullName }).click();
  await expect(page.getByRole("heading", { level: 1, name: cg.fullName })).toBeVisible();
  await expect(page.getByText("En attente de vérification").first()).toBeVisible();

  const decision = page.getByRole("region", { name: "Décision (revue humaine)" });
  // Validation impossible tant que les vérifications obligatoires ne sont pas validées.
  await expect(decision.getByText("Validation pas encore possible")).toBeVisible();

  // Refuser sans motif → erreur serveur sur le champ « Motif ».
  await decision.getByLabel("Refuser le profil").check();
  await decision.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(decision.getByText(/Écrivez le motif/)).toBeVisible();

  // Revue des vérifications : identité, casier, diplôme (ouvre le niveau 4).
  for (const label of ["Pièce d'identité", "Extrait de casier judiciaire", "Diplôme d'aide à la personne"]) {
    const card = page.getByRole("region", { name: label });
    await card.getByRole("button", { name: "Valider" }).click();
    await expect(card.getByText("Vérification validée.")).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("Niveau 4 — Aide renforcée")).toBeVisible();

  // Valider le profil.
  const decision2 = page.getByRole("region", { name: "Décision (revue humaine)" });
  await decision2.getByLabel("Valider le profil").check();
  await decision2.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(decision2.getByText(/Décision enregistrée : Validé/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Validé (vérifications déclarées)", { exact: true }).first()).toBeVisible();

  // Suspendre : motif obligatoire, puis le motif s'affiche sur la fiche.
  const decision3 = page.getByRole("region", { name: "Décision (revue humaine)" });
  await decision3.getByLabel("Motif").fill("Absence non prévenue signalée par une famille (test).");
  await decision3.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(decision3.getByText(/Décision enregistrée : Suspendu/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Motif de la dernière décision")).toBeVisible();
  await expect(page.getByRole("region", { name: "Décision (revue humaine)" }).getByLabel("Réactiver le profil")).toBeVisible();

  // Notifications simulées + audit.
  const messages = await prisma.outboxMessage.findMany({ where: { recipientUserId: cg.user.id }, select: { template: true } });
  expect(messages.map((m) => m.template).sort()).toEqual(["ACCOMPAGNANT_SUSPENDU", "ACCOMPAGNANT_VALIDE"]);
  await page.goto("/operateur/journal-audit?action=caregiver.suspend");
  await expect(page.getByRole("cell", { name: cg.profile.id })).toBeVisible();
});

test("O4/O5 — matching manuel (D6) : compatibles d'abord, profil proposé À LA FAMILLE, refus serveur d'un auto-entrepreneur sur un niveau 3", async ({ page }) => {
  // Le Marin : aucune personne de la démo ne dessert cette commune.
  const fam = await createFamilyWithAine({ aineFirstName: `Aîné${uid()}`, commune: "MARIN", activityLevel: 3 });
  const req = await createRequest({ aineId: fam.aine.id, createdById: fam.user.id, level: 3, slots: [[2, "MATIN"]] });
  const ae = await createCaregiver({
    firstName: "Autoentrepreneur",
    status: "AUTO_ENTREPRENEUR_SAP",
    validation: "VALIDE",
    communes: ["MARIN"],
    avail: [[2, "MATIN"]],
  });
  const ok = await createCaregiver({
    firstName: "Salariee",
    status: "SALARIE_FAMILLE_CESU",
    validation: "VALIDE",
    communes: ["MARIN"],
    avail: [[2, "MATIN"]],
  });

  await loginOperateur(page);
  await page.goto("/operateur/demandes");
  await page.getByRole("link", { name: new RegExp(fam.aine.firstName) }).click();
  await expect(page).toHaveURL(new RegExp(`/operateur/demandes/${req.id}$`));

  const compatibles = page.getByRole("region", { name: /Accompagnants compatibles/ });
  const incompatibles = page.getByRole("region", { name: /Accompagnants non compatibles/ });
  await expect(compatibles.getByRole("heading", { name: ok.fullName })).toBeVisible();
  const aeCard = incompatibles.getByRole("article", { name: ae.fullName });
  await expect(aeCard.getByText("Niveau non autorisé pour ce statut")).toBeVisible();
  await expect(aeCard.getByRole("button", { name: /Proposer/ })).toHaveCount(0);

  // Attaque : on modifie le champ caché du formulaire pour viser l'auto-entrepreneur.
  const okCard = compatibles.getByRole("article", { name: ok.fullName });
  await okCard.locator('input[name="caregiverId"]').evaluate((el, id) => ((el as HTMLInputElement).value = id), ae.profile.id);
  await okCard.getByRole("button", { name: `Proposer ${ok.fullName} à la famille` }).click();
  await expect(okCard.getByText(/Proposition refusée : accompagnant incompatible \(Niveau non autorisé pour ce statut\)/)).toBeVisible();
  expect(await prisma.missionProposal.count({ where: { requestId: req.id } })).toBe(0);

  // Proposition normale à la salariée compatible.
  await page.reload();
  const okCard2 = page.getByRole("article", { name: ok.fullName });
  await okCard2.getByText("Ajouter un message (facultatif)").click();
  await okCard2.getByLabel(`Message pour ${ok.fullName}`).fill("Mercredi matin, 1 heure. Vous êtes libre de refuser.");
  await okCard2.getByRole("button", { name: `Proposer ${ok.fullName} à la famille` }).click();
  await expect(okCard2.getByText(/proposé à la famille/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Profils proposés à la famille" }).getByText(ok.fullName, { exact: false })).toBeVisible();
  await expect(page.getByRole("article", { name: ok.fullName }).getByText("Profil proposé à la famille")).toBeVisible();
  expect((await prisma.careRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PROPOSEE");
  // D6 : l'accompagnant n'est PAS encore sollicité ; la famille doit d'abord choisir.
  const proposal = await prisma.missionProposal.findFirstOrThrow({ where: { requestId: req.id } });
  expect(proposal.status).toBe("PROPOSEE_FAMILLE");

  // Boîte d'envoi : PROFILS_PROPOSES pour la famille ; journal : proposition bloquée tracée.
  await page.goto("/operateur/notifications?modele=PROFILS_PROPOSES");
  await expect(page.getByText(new RegExp(`Des profils pour ${fam.aine.firstName}`)).first()).toBeVisible();
  await page.goto("/operateur/journal-audit?action=proposal.blocked");
  await expect(page.getByRole("cell", { name: req.id })).toBeVisible();
});

test("O6/O7 (L1-B, R7) — visite à vérifier : l'opérateur ne tranche pas, la famille employeur confirme", async ({ page }) => {
  const fam = await createFamilyWithAine({ aineFirstName: `Visite${uid()}`, commune: "MARIN" });
  const req = await createRequest({ aineId: fam.aine.id, createdById: fam.user.id, level: 1, slots: [] });
  const cg = await createCaregiver({ firstName: "Visiteuse", status: "BENEVOLE_ASSO", validation: "VALIDE", communes: ["MARIN"], avail: [] });
  const visit = await createVisitToCheck({ aineId: fam.aine.id, requestId: req.id, caregiverId: cg.profile.id, operatorId: await operatorId() });

  await loginOperateur(page);
  await page.goto("/operateur/visites?statut=A_VERIFIER");
  const card = page.getByRole("article", { name: new RegExp(fam.aine.firstName) });
  await expect(card.getByText("À vérifier", { exact: true })).toBeVisible();
  await expect(card.getByText(/Code du domicile : valide/)).toBeVisible();
  await expect(card.getByText("La famille employeur confirme ou signale cette visite.")).toBeVisible();
  await expect(card.getByRole("button", { name: /appel simulé/ })).toHaveCount(0);
  // R3 : l'opérateur voit seulement « trajet partagé : oui/non ».
  await expect(card.getByText("Trajet partagé : non")).toBeVisible();

  await page.context().clearCookies();
  await login(page, fam.user.email);
  await page.goto("/famille/visites");
  const review = page.getByRole("form", { name: new RegExp(`Trancher la visite chez ${fam.aine.firstName}`) });
  await review.getByRole("button", { name: "Oui, la visite a eu lieu" }).click();
  await expect(page.getByText("Merci. La visite est validée.")).toBeVisible();
  expect((await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } })).status).toBe("VALIDEE");
});

test("O8 — retours testeurs : un avis envoyé apparaît, puis passe de Nouveau à Lu à Traité", async ({ page }) => {
  const message = `${FEEDBACK_MARK} ${uid()} Le bouton de connexion est trop bas sur mon téléphone.`;
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Donner mon avis" }).click();
  const dialog = page.getByRole("dialog", { name: "Donner mon avis" });
  await dialog.getByText("Moyen", { exact: true }).click();
  await dialog.getByLabel("Votre message").fill(message);
  await dialog.getByRole("button", { name: "Envoyer mon avis" }).click();
  await expect(dialog.getByText("Merci !")).toBeVisible();

  await loginOperateur(page);
  await page.goto("/operateur/retours?statut=NOUVEAU");
  const card = page.getByRole("article").filter({ hasText: message });
  await expect(card.getByText("Nouveau", { exact: true })).toBeVisible();
  await expect(card.getByText("/connexion")).toBeVisible();
  await card.getByRole("button", { name: "Marquer comme lu" }).click();
  // Le retour quitte la liste « Nouveau » dès que le serveur a enregistré le statut.
  await expect(card).toHaveCount(0);
  await page.goto("/operateur/retours?statut=LU");
  const lu = page.getByRole("article").filter({ hasText: message });
  await expect(lu.getByText("Lu", { exact: true })).toBeVisible();
  await lu.getByRole("button", { name: "Marquer comme traité" }).click();
  await expect(lu).toHaveCount(0);
  await page.goto("/operateur/retours?statut=TRAITE");
  await expect(page.getByRole("article").filter({ hasText: message }).getByText("Traité", { exact: true })).toBeVisible();

  // Export CSV (audité).
  const res = await page.request.get("/operateur/retours/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain(message);
});

test("O9 — journal d'audit filtrable, en lecture seule", async ({ page }) => {
  await loginOperateur(page);
  await page.goto("/operateur/journal-audit");
  await expect(page.getByRole("heading", { level: 1, name: "Journal d'audit" })).toBeVisible();
  await page.getByLabel("Action").selectOption("auth.login");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const actions = await page.getByRole("table").locator("tbody tr td:nth-child(3)").allInnerTexts();
  expect(actions.length).toBeGreaterThan(0);
  expect(new Set(actions)).toEqual(new Set(["auth.login"]));
  await expect(page.getByRole("button", { name: /Supprimer|Modifier/ })).toHaveCount(0);
});

test("Accès — une famille ne peut ouvrir aucun écran opérateur, ni l'export", async ({ page }) => {
  const fam = await createFamilyWithAine({ aineFirstName: `Acces${uid()}`, commune: "MARIN" });
  await login(page, fam.user.email);
  for (const path of ["/operateur/accompagnants", "/operateur/retours", "/operateur/journal-audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/famille$/);
  }
  const res = await page.request.get("/operateur/retours/export", { maxRedirects: 0 });
  expect(res.headers()["content-type"] ?? "").not.toContain("text/csv");
});
