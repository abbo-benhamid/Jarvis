import { expect, test } from "@playwright/test";
import { cleanupE2E, createDraftCaregiver, E2E_PASSWORD, login, loginOperateur, prisma } from "./fixtures";

/**
 * L2 : vérification de l'accompagnant, de bout en bout, avec les adaptateurs SIMULÉS (mode essai, aucun appel réseau).
 * Téléphone (code 000000) → identité (page simulée, webhook signé) → adresse + justificatif → demande →
 * revue opérateur (motif d'accès journalisé, liste de cases) → adresse validée.
 */
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanupE2E();
});
test.afterAll(async () => {
  await cleanupE2E();
  await prisma.$disconnect();
});

test("L2 : l'accompagnant vérifie son téléphone, son identité et son adresse, puis l'opérateur relit le justificatif", async ({ page, browser }) => {
  const cg = await createDraftCaregiver("Josiane");
  await login(page, cg.user.email, E2E_PASSWORD);

  await page.goto("/accompagnant/verifications");
  const dossier = page.getByRole("region", { name: "Mon dossier" }).or(page.getByLabel("Mon dossier"));
  await expect(dossier.getByText("Numéro de téléphone", { exact: true })).toBeVisible();
  await expect(dossier.getByText("Identité", { exact: true })).toBeVisible();
  await expect(dossier.getByText("Adresse", { exact: true })).toBeVisible();

  // Téléphone : code simulé 000000.
  await page.goto("/accompagnant/verifications/telephone");
  const n = String(Date.now()).slice(-6);
  await page.getByLabel("Votre numéro de mobile").fill(`0696 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)}`);
  await page.getByRole("button", { name: "Recevoir un code par SMS" }).click();
  await page.getByLabel("Code à 6 chiffres").fill("123456");
  await page.getByRole("button", { name: "Vérifier le code" }).click();
  await expect(page.getByText(/Code faux. Il reste 4 essais/)).toBeVisible();
  await page.getByLabel("Code à 6 chiffres").fill("000000");
  await page.getByRole("button", { name: "Vérifier le code" }).click();
  await expect(page.getByText(/Numéro vérifié : \+596 696 •• •• /).first()).toBeVisible();

  // Identité : consentement obligatoire, puis page du prestataire simulé.
  await page.goto("/accompagnant/verifications/identite");
  await expect(page.getByText("Ce que Koudmen garde :")).toBeVisible();
  await page.getByRole("button", { name: "Commencer la vérification" }).click();
  await expect(page.getByText(/Cochez la case/).first()).toBeVisible();
  await page.getByLabel(/J'accepte la vérification par photo/).check();
  await page.getByRole("button", { name: "Commencer la vérification" }).click();
  await page.waitForURL(/\/verification\/simulee\?session=sim_/);
  await page.getByRole("button", { name: "Pièce et visage conformes" }).click();
  await page.waitForURL(/\/accompagnant\/verifications\/identite\?retour=1/);
  await expect(page.getByText("Vérifié", { exact: true })).toBeVisible();

  // Adresse + justificatif (PDF), contrôlé et chiffré.
  await page.goto("/accompagnant/verifications/adresse");
  await page.getByLabel("Numéro et voie").fill("12 rue des Flamboyants");
  await page.getByLabel("Code postal").fill("97232");
  await page.getByLabel("Commune").fill("Le Lamentin");
  await page.getByRole("button", { name: "Enregistrer mon adresse" }).click();
  await expect(page.getByText(/Adresse enregistrée/)).toBeVisible();
  await page.getByLabel("Fichier").setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nfacture fictive e2e\n%%EOF") });
  await page.getByRole("button", { name: "Envoyer le document" }).click();
  await expect(page.getByText(/Document reçu/).first()).toBeVisible();

  // Demande de vérification : tout est prêt (adresse en relecture = en cours).
  await page.goto("/accompagnant/verifications");
  await page.getByRole("button", { name: "Demander la vérification" }).click();
  await expect(page.getByText(/demande est envoyée|Demande envoyée/).first()).toBeVisible();
  expect((await prisma.caregiverProfile.findUniqueOrThrow({ where: { id: cg.profile.id } })).validation).toBe("EN_ATTENTE");

  // Opérateur : file, aperçu avec motif (journalisé), liste de cases.
  const ctx = await browser.newContext();
  const op = await ctx.newPage();
  await loginOperateur(op);
  await op.goto("/operateur/verifications");
  const row = op.getByRole("row").filter({ hasText: "Josiane Bellemare" }).filter({ hasText: "Document à relire" });
  await row.getByRole("link", { name: "Revoir" }).click();
  await expect(op.getByRole("heading", { level: 1, name: "Adresse" })).toBeVisible();
  await expect(op.getByText("12 rue des Flamboyants, 97232 Le Lamentin")).toBeVisible();
  await op.getByRole("button", { name: "Ouvrir l'aperçu" }).click();
  await expect(op.getByRole("link", { name: "Ouvrir le PDF dans un nouvel onglet" })).toBeVisible();
  const doc = await prisma.sensitiveDocument.findFirstOrThrow({ where: { verificationItem: { caregiverId: cg.profile.id } } });
  const res = await op.request.get(`/operateur/documents/${doc.id}/apercu?motif=REVUE_DOSSIER`);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect((await res.body()).toString()).toContain("facture fictive e2e");
  expect((await op.request.get(`/operateur/documents/${doc.id}/apercu`)).status()).toBe(400);
  expect(await prisma.documentAccessLog.count({ where: { documentId: doc.id } })).toBeGreaterThanOrEqual(1);

  await op.getByLabel("Valider").check();
  await op.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(op.getByText(/Cochez toutes les cases/)).toBeVisible();
  for (const label of [/Le nom correspond/, /L'adresse correspond/, /moins de 3 mois/, /type accepté/, /Aucun signe de retouche/]) await op.getByLabel(label).check();
  await op.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(op.getByText("Décision prise : Vérifié.")).toBeVisible();
  const item = await prisma.verificationItem.findFirstOrThrow({ where: { caregiverId: cg.profile.id, type: "ADRESSE" } });
  expect(item.status).toBe("VALIDE");
  const decided = await prisma.sensitiveDocument.findUniqueOrThrow({ where: { id: doc.id } });
  expect(decided.deleteAfter).not.toBeNull();
  await ctx.close();
});

test("L2 : webhook d'identité sans signature refusé ; API v1 du dossier sans jeton refusée", async ({ request }) => {
  expect((await request.post("/api/webhooks/identite/veriff", { data: { verification: { id: "x", status: "approved" } } })).status()).toBe(401);
  expect((await request.post("/api/webhooks/identite/simule", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/webhooks/identite/inconnu", { data: {} })).status()).toBe(404);
  expect((await request.get("/api/v1/accompagnant/verifications")).status()).toBe(401);
});
