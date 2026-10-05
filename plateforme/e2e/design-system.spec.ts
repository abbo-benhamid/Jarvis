import { expect, test } from "@playwright/test";

/**
 * Lot W1 (ADR 0008) : la page de démonstration des composants s'affiche à 390 px, en clair et en sombre,
 * sans défilement horizontal, et la bascule de thème est mémorisée.
 */
for (const scheme of ["light", "dark"] as const) {
  test(`/tester/design à 390 px en ${scheme === "light" ? "clair" : "sombre"}`, async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto("/tester/design");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("bonne nouvelle");
    await expect(page.getByRole("region", { name: "État de Léonie" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Reçu de visite" })).toContainText("2 preuves sur 3 · visite validée");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: info.outputPath(`design-390-${scheme}.png`), fullPage: true });
    await ctx.close();
  });
}

test("la bascule de thème pose data-theme et le garde après rechargement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tester/design");
  await page.getByRole("button", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Sombre" })).toHaveAttribute("aria-pressed", "true");
});

test("formules : radios natives au clavier", async ({ page }) => {
  await page.goto("/tester/design");
  const serenite = page.getByRole("radio", { name: /Sérénité/ });
  await expect(serenite).toBeChecked();
  await page.getByRole("radio", { name: /Kozé/ }).check();
  await expect(page.getByRole("radio", { name: /Kozé/ })).toBeChecked();
  await expect(serenite).not.toBeChecked();
});
