import { expect, test } from "@playwright/test";
import { cleanupE2E, createCaregiver, createFamilyWithAine, createRequest, login, operatorId, prisma, uid } from "./fixtures";

/**
 * Lot L1-B (présence) : carte domicile imprimable, « Où en est la visite » (carte MapLibre + liste textuelle),
 * vue réservée à l'employeur et à la personne désignée (R4).
 * Les tuiles OpenFreeMap peuvent manquer (réseau du CI) : on vérifie le texte, jamais le rendu de la carte.
 */
test.afterAll(async () => {
  await cleanupE2E();
  await prisma.$disconnect();
});

const HOME = { lat: 14.6131, lng: -60.9996 };

async function visitSoon(aineId: string, createdById: string) {
  const req = await createRequest({ aineId, createdById, level: 1, slots: [] });
  const cg = await createCaregiver({ firstName: "Josiane", status: "BENEVOLE_ASSO", validation: "VALIDE", communes: ["LAMENTIN"], avail: [] });
  const proposal = await prisma.missionProposal.create({
    data: { requestId: req.id, caregiverId: cg.profile.id, proposedById: await operatorId(), status: "ACCEPTEE", respondedAt: new Date() },
  });
  const mission = await prisma.mission.create({ data: { requestId: req.id, proposalId: proposal.id, aineId, caregiverId: cg.profile.id } });
  const start = new Date(Date.now() + 40 * 60_000);
  const visit = await prisma.visit.create({
    data: { missionId: mission.id, aineId, caregiverId: cg.profile.id, scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3_600_000) },
  });
  return { visit, cg };
}

test("L9 — carte domicile : QR signé, code de secours, impression, nouvelle carte (version + 1)", async ({ page }) => {
  const fam = await createFamilyWithAine({ aineFirstName: `Carte${uid()}`, commune: "LAMENTIN" });
  await login(page, fam.user.email);
  await page.goto(`/famille/aines/${fam.aine.id}`);
  await page.getByRole("link", { name: /Carte domicile/ }).click();
  await expect(page).toHaveURL(new RegExp(`/famille/aines/${fam.aine.id}/carte-domicile`));
  const qr = page.getByRole("img", { name: /QR code signé du domicile/ });
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("data-qr-contenu")).toMatch(/^koudmen:domicile:s1:[\w-]+\.[\w-]+\.[\w-]+$/);
  expect(await qr.getAttribute("data-qr-contenu")).not.toContain(fam.aine.id);
  await expect(page.getByText(fam.aine.homeCode, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimer la carte" })).toBeVisible();
  await expect(page.getByText(/Version 1 ·/)).toBeVisible();

  await page.getByRole("button", { name: "Créer une nouvelle carte" }).click();
  await expect(page.getByText("Cochez la case pour confirmer.")).toBeVisible();
  await page.getByLabel(/l'ancienne carte ne marchera plus/).check();
  await page.getByRole("button", { name: "Créer une nouvelle carte" }).click();
  await expect(page.getByText(/Nouvelle carte créée \(version 2\)/)).toBeVisible();
  const after = await prisma.aine.findUniqueOrThrow({ where: { id: fam.aine.id } });
  expect(after.homeCardVersion).toBe(2);
  expect(after.homeCode).not.toBe(fam.aine.homeCode);
});

test("L6/L7/R4 — « Où en est la visite » : en route (liste textuelle), hors trajet l'heure prévue seulement ; cercle non désigné : 404", async ({ page }) => {
  const fam = await createFamilyWithAine({ aineFirstName: `Trajet${uid()}`, commune: "LAMENTIN" });
  await prisma.aine.update({ where: { id: fam.aine.id }, data: { latitude: HOME.lat, longitude: HOME.lng, locationApproximate: false } });
  const { visit, cg } = await visitSoon(fam.aine.id, fam.user.id);

  await login(page, fam.user.email);
  await page.goto("/famille/visites");
  await page.getByRole("link", { name: "Où en est la visite ?" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/famille/visites/${visit.id}/trajet`));
  // Hors trajet : l'heure prévue seulement, jamais « non partagé ».
  await expect(page.getByText(/Visite prévue à \d{1,2} h( \d{2})? \(heure de Martinique\) avec Josiane\./)).toBeVisible();
  await expect(page.getByText(/non partagé/i)).toHaveCount(0);

  // Trajet en cours, 2 km du domicile, départ à plus de 500 m.
  await prisma.visitTrip.create({
    data: {
      visitId: visit.id,
      userId: cg.user.id,
      expiresAt: new Date(Date.now() + 50 * 60_000),
      startLatitude: 14.64,
      startLongitude: -60.9996,
      latitude: 14.631,
      longitude: -60.9996,
      accuracyMeters: 110,
      positionAt: new Date(),
      receivedAt: new Date(),
    },
  });
  await page.reload();
  await expect(page.getByText(/Josiane est en route\. Arrivée dans \d+ min environ\./)).toBeVisible();
  const details = page.getByRole("region", { name: "Détails du trajet" });
  await expect(details.getByText(/Distance jusqu'au domicile : environ 2,0 km/)).toBeVisible();
  await expect(details.getByText(/précise à environ 110 m/)).toBeVisible();

  // Un membre du cercle non désigné ne voit rien (404).
  const cousin = await prisma.user.create({
    data: { email: `cousin-${uid()}@e2e.koudmen.test`, passwordHash: (await prisma.user.findUniqueOrThrow({ where: { id: fam.user.id } })).passwordHash, role: "FAMILLE", firstName: "Cousin", lastName: "E2E" },
  });
  await prisma.lakouMember.create({ data: { aineId: fam.aine.id, userId: cousin.id, relation: "cousin" } });
  await page.context().clearCookies();
  await login(page, cousin.email);
  const res = await page.request.get(`/api/famille/visites/${visit.id}/trajet`);
  expect(res.status()).toBe(404);
  await page.goto("/famille/visites");
  await expect(page.getByRole("link", { name: "Où en est la visite ?" })).toHaveCount(0);
});
