import { defineConfig } from '@playwright/test';

/** Tests unitaires des lots L1-C et L1d (modules purs, sans navigateur ni serveur). `npm run test:l1`. */
export default defineConfig({
  testDir: '../..',
  testMatch: ['trajet/__tests__/trajet.spec.ts', 'compte/__tests__/inscription.spec.ts', 'compte/__tests__/orientation.spec.ts'],
  reporter: [['list']],
});
