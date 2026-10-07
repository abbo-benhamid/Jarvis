import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Les tests lisent les mêmes variables que l'application (codes testeurs, mots de passe locaux).
// En CI, elles viennent de l'environnement du job ; en local, du fichier .env.
if (existsSync(".env")) process.loadEnvFile(".env");

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
        // Les e2e créent beaucoup de bacs à sable depuis la même adresse : limites de débit coupées
        // (jamais en production : config-check refuse RATE_LIMIT_DISABLED). Tests des limites : rate-limit.db.test.ts.
        // L1-B : géocodage simulé (aucun appel réseau à api-adresse.data.gouv.fr pendant les e2e).
        env: { RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED ?? "true", ADAPTER_GEOCODAGE: process.env.ADAPTER_GEOCODAGE ?? "simule" },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
