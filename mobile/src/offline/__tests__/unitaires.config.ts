import { defineConfig } from '@playwright/test';

/** Tests unitaires du lot M3 (modules purs, sans navigateur ni serveur). `npm run test:hors-ligne`. */
export default defineConfig({
  testDir: '.',
  testMatch: ['file.spec.ts', 'horsligne.spec.ts', 'chiffre.spec.ts', 'cache.spec.ts', 'v1c.spec.ts'],
  reporter: [['list']],
});
