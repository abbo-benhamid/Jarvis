import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/** T1 : lancement en Guadeloupe ; « Bientôt » et liste d'attente pour les autres territoires. */
const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.waitlistEntry.deleteMany({ where: { email: { endsWith: "@e2e.koudmen.test" } } });
  await prisma.$disconnect();
});

test("T1 : l'accueil dit « Koudmen ouvre en Guadeloupe » et mène à la liste d'attente préremplie", async ({ page }) => {
  await page.goto("/");
  const encart = page.getByTestId("encart-bientot");
  await expect(encart).toContainText("Koudmen ouvre en Guadeloupe.");
  await encart.getByRole("link", { name: "Guyane" }).click();
  await expect(page).toHaveURL(/\/liste-attente\?territoire=GUYANE$/);
  await expect(page.getByRole("heading", { name: "Koudmen arrive bientôt en Guyane" })).toBeVisible();
  await expect(page.locator("#territoire")).toHaveValue("GUYANE");
  // La Guadeloupe est ouverte : elle n'est pas dans la liste d'attente.
  await expect(page.locator("#territoire option[value=GUADELOUPE]")).toHaveCount(0);
});

test("T1 : liste d'attente — consentement obligatoire, puis même message (aucune fuite)", async ({ page }) => {
  const email = `attente-${Date.now()}@e2e.koudmen.test`;
  for (let i = 0; i < 2; i++) {
    await page.goto("/liste-attente?territoire=MARTINIQUE");
    await page.locator("#email").fill(email);
    if (i === 0) {
      await page.getByRole("button", { name: "M'inscrire sur la liste d'attente" }).click();
      await expect(page.getByText("Cochez la case pour vous inscrire sur la liste d'attente.").first()).toBeVisible();
    }
    await page.locator("#consentement").check();
    await page.getByRole("button", { name: "M'inscrire sur la liste d'attente" }).click();
    await expect(page.getByText(/C'est noté\./)).toBeVisible();
  }
  expect(await prisma.waitlistEntry.count({ where: { email, territoire: "MARTINIQUE" } })).toBe(1);
});

test("T1 : GET /api/v1/territoires et POST /api/v1/liste-attente (202 toujours)", async ({ request }) => {
  const res = await request.get("/api/v1/territoires");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { territoires: { code: string; etat: string; fuseau: string; communes: unknown[] }[] };
  expect(body.territoires.find((t) => t.code === "GUADELOUPE")).toMatchObject({ etat: "OUVERT", fuseau: "America/Guadeloupe" });
  expect(body.territoires.find((t) => t.code === "GUADELOUPE")!.communes).toHaveLength(32);
  const email = `api-attente-${Date.now()}@e2e.koudmen.test`;
  for (let i = 0; i < 2; i++) {
    const r = await request.post("/api/v1/liste-attente", { data: { email, territoire: "HEXAGONE", consentement: true } });
    expect(r.status()).toBe(202);
    expect(await r.json()).toEqual({});
  }
  const bad = await request.post("/api/v1/liste-attente", { data: { email, territoire: "HEXAGONE" } });
  expect(bad.status()).toBe(400);
});
