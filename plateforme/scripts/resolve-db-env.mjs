/**
 * Fait correspondre les variables créées par l'intégration Neon de Vercel
 * aux noms attendus par Prisma (DATABASE_URL + DIRECT_URL).
 * - DIRECT_URL ← DATABASE_URL_UNPOOLED ou POSTGRES_URL_NON_POOLING si absente.
 * - DATABASE_URL ← POSTGRES_PRISMA_URL ou POSTGRES_URL si absente.
 */
export function resolveDbEnv(env = process.env) {
  env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  env.DIRECT_URL ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
  return env;
}
