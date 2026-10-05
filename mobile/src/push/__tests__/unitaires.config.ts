import { defineConfig } from '@playwright/test';

/** Tests unitaires du lot N1 (modules purs, sans navigateur ni serveur). */
export default defineConfig({
  testDir: '.',
  testMatch: 'push.spec.ts',
  reporter: [['list']],
});
