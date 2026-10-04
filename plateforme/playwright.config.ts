import { defineConfig, devices } from "@playwright/test";

// Port configurable : E2E_PORT (prioritaire) ou PORT. Utile quand plusieurs serveurs tournent en parallèle.
const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Efface les restes d'un run interrompu (comptes @e2e.koudmen.test). Ne touche pas aux données de démo.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "America/Martinique",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Démarre l'app si E2E_BASE_URL n'est pas fourni. La base doit être migrée et seedée.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
