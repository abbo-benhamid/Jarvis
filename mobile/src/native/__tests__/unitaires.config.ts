import { defineConfig } from '@playwright/test';

/** Tests unitaires du lot M4 (modules purs, sans navigateur ni serveur). */
export default defineConfig({
  testDir: '.',
  testMatch: 'codeDomicile.spec.ts',
  reporter: [['list']],
});
