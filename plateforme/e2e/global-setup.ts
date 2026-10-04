import { cleanupE2E, prisma } from "./fixtures";

/** Avant la suite e2e : efface les restes d'un run interrompu. Les données de démo ne sont pas touchées. */
export default async function globalSetup() {
  await cleanupE2E();
  await prisma.$disconnect();
}
