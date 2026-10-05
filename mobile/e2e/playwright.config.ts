import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4319);

/**
 * Tests de l'app sur l'export web (ADR 0008 : pas de simulateur dans la sandbox).
 * Prérequis : `npm run export:web`. Chromium préinstallé (PLAYWRIGHT_BROWSERS_PATH).
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
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
  webServer: {
    command: `node serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    cwd: __dirname,
  },
});
