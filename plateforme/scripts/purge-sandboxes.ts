/**
 * Purge des bacs à sable de plus de 30 jours (D2) et durées de conservation (M6).
 *   pnpm ops:purge-sandboxes
 * En production, Vercel Cron appelle /api/cron/purge-bacs-a-sable chaque nuit (vercel.json).
 */
import { PrismaClient } from "@prisma/client";
import { parseTestEndDate, purgeExpiredSandboxes, purgeRetention } from "../src/server/sandbox/purge";

const prisma = new PrismaClient();
(async () => {
  const n = await purgeExpiredSandboxes(prisma);
  const r = await purgeRetention(prisma, new Date(), parseTestEndDate(process.env.TEST_END_DATE));
  return `Bacs à sable purgés : ${n}. Visites découverte : ${r.discoveries}. Avis : ${r.feedbacks}. Événements : ${r.usageEvents}. Micro-réponses : ${r.microAnswers}.`;
})()
  .then((msg) => console.log(msg))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
