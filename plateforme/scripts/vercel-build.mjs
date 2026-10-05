/** Build de production (Vercel) : prisma generate → migrate deploy → next build. */
import { execSync } from "node:child_process";
import { resolveDbEnv } from "./resolve-db-env.mjs";

const env = resolveDbEnv({ ...process.env });
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL absente : reliez une base Neon au projet Vercel.");
  process.exit(1);
}
for (const cmd of ["prisma generate", "prisma migrate deploy", "next build"]) {
  console.log(`> ${cmd}`);
  execSync(`pnpm exec ${cmd}`, { stdio: "inherit", env });
}
