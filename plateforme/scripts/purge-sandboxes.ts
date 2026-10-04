/**
 * Purge des bacs à sable de plus de 30 jours (D2).
 *   pnpm ops:purge-sandboxes
 * En production, Vercel Cron appelle /api/cron/purge-bacs-a-sable chaque nuit (vercel.json).
 */
import { PrismaClient } from "@prisma/client";
import { purgeExpiredSandboxes } from "../src/server/sandbox/purge";

const prisma = new PrismaClient();
purgeExpiredSandboxes(prisma)
  .then((n) => console.log(`Bacs à sable purgés : ${n}.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
