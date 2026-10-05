import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4319);

/**
 * Démo HORS LIGNE (adaptateur simulé, sans serveur).
 * Prérequis : `EXPO_PUBLIC_API_MODE=simule npx expo export -p web --output-dir dist-simule`.
 */
export default defineConfig({
  testDir: './simule',
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
    command: `node ../scripts/proxy-dev.mjs --port ${PORT} --dist dist-simule`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    cwd: __dirname,
  },
});
