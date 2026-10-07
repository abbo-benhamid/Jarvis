import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Les tests lisent les mêmes variables que l'application (codes testeurs, mots de passe locaux).
// En CI, elles viennent de l'environnement du job ; en local, du fichier .env.
if (existsSync(".env")) process.loadEnvFile(".env");

// Port configurable : E2E_PORT (prioritaire) ou PORT. Utile quand plusieurs serveurs tournent en parallèle.
const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// L1-A : second serveur en MODE LANCEMENT (sans démo ni bac à sable), sur le port suivant.
const LAUNCH_PORT = PORT + 1;
const launchURL = process.env.E2E_LAUNCH_BASE_URL ?? `http://localhost:${LAUNCH_PORT}`;
/** E-mails capturés par l'adaptateur `console` du serveur de lancement (jamais en production stricte). */
const MAIL_CAPTURE_FILE = join(tmpdir(), `koudmen-e2e-mails-${LAUNCH_PORT}.jsonl`);
process.env.E2E_MAIL_CAPTURE_FILE = MAIL_CAPTURE_FILE;

// Les e2e créent beaucoup de comptes et de bacs à sable depuis la même adresse : limites de débit coupées
// (jamais en production : config-check refuse RATE_LIMIT_DISABLED). Tests des limites : rate-limit.db.test.ts.
const RATE = { RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED ?? "true" };

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
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "America/Martinique",
  },
  projects: [
    // Mode ESSAI (démo, bac à sable, robots) : toutes les suites existantes.
    { name: "chromium", testIgnore: /lancement\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL } },
    // Mode LANCEMENT (L1) : inscription, e-mails, préinscription, démo fermée.
    { name: "lancement", testMatch: /lancement\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: launchURL } },
  ],
  // Démarre les deux serveurs si E2E_BASE_URL n'est pas fourni. La base doit être migrée et seedée.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `pnpm exec next start -p ${PORT}`,
          env: { ...RATE, KOUDMEN_MODE: "essai" },
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `pnpm exec next start -p ${LAUNCH_PORT}`,
          env: { ...RATE, KOUDMEN_MODE: "lancement", MAIL_CAPTURE_FILE, BREVO_API_KEY: "" },
          url: launchURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
