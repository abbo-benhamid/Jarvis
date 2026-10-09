import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4320);
/** Serveur `plateforme/` lancé à part (DEMO_MODE=true). */
const API = process.env.API_CIBLE ?? 'http://localhost:3731';

/**
 * Critère de fin du lot M2 (ADR 0008) : Playwright sur l'export web CONTRE le vrai serveur local.
 *
 * Prérequis :
 *   1. plateforme/ lancée (ex. `PORT=3731 pnpm start`), base de démo présente (pas de db:seed ici) ;
 *   2. `EXPO_PUBLIC_API_URL=/ npx expo export -p web` (l'app appelle /api/v1 sur sa propre origine) ;
 *   3. `npm run e2e` : `scripts/proxy-dev.mjs` sert dist/ et relaie /api vers plateforme (pas de CORS).
 *
 * Chromium préinstallé (PLAYWRIGHT_BROWSERS_PATH). Les tests créent puis effacent leurs données (`reel/donnees.mjs`).
 */
export default defineConfig({
  testDir: './reel',
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
    timezoneId: 'America/Guadeloupe',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node ../scripts/proxy-dev.mjs --port ${PORT} --api ${API}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    cwd: __dirname,
  },
});
