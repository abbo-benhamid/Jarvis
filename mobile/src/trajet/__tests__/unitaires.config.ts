import { defineConfig } from '@playwright/test';

/** Tests unitaires du lot L1-C (modules purs, sans navigateur ni serveur). `npm run test:l1`. */
export default defineConfig({
  testDir: '../..',
  testMatch: ['trajet/__tests__/trajet.spec.ts', 'compte/__tests__/inscription.spec.ts'],
  reporter: [['list']],
});
