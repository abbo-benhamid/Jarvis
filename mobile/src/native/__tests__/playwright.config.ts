import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4327);

/**
 * Tests du lot M4 (adaptateurs simulés).
 * - `codeDomicile.spec.ts` : unitaires, sans navigateur (`unitaires.config.ts`).
 * - `fiche-native.spec.ts` : export web simulé (`npm run export:web:simule`), écran 390 px.
 * `SHOTS_DIR=/chemin` ajoute des captures.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'fiche-*.spec.ts',
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
    timezoneId: 'America/Guadeloupe',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node ../../../scripts/proxy-dev.mjs --port ${PORT} --dist dist-simule`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
});
