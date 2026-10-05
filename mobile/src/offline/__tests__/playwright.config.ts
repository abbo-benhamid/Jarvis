import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4330);
const PORT_API = Number(process.env.PORT_API ?? 4331);

/**
 * E2E du lot M3 : coupure réseau RÉELLE du navigateur (`context.setOffline`).
 *
 * Prérequis : `EXPO_OFFLINE=1 npm run export:web:hors-ligne` (app en mode http, API sur la même origine).
 * - `api-factice.mjs` : API v1 factice (idempotente par clientEventId), journal des événements reçus ;
 * - `scripts/proxy-dev.mjs` : sert l'export et relaie /api vers l'API factice (même origine, pas de CORS).
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'hors-ligne.e2e.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    timezoneId: 'America/Martinique',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `node api-factice.mjs --port ${PORT_API}`,
      url: `http://localhost:${PORT_API}/__journal`,
      reuseExistingServer: false,
    },
    {
      command: `node ../../../scripts/proxy-dev.mjs --port ${PORT} --dist dist-hors-ligne --api http://localhost:${PORT_API}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
    },
  ],
});
