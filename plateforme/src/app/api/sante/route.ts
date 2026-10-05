import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { productionConfigProblems } from "@/server/config-check";

export const dynamic = "force-dynamic";

/**
 * Diagnostic public minimal pour la mise en ligne : configuration et base de données.
 * Ne renvoie jamais de valeur secrète ni d'URL de connexion : seulement des noms et des codes d'erreur.
 */
export async function GET() {
  const config = productionConfigProblems();
  let database: { ok: boolean; erreur?: string; migrations?: number } = { ok: false };
  try {
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    database = { ok: true, migrations: Number(rows[0]?.n ?? 0) };
  } catch (e) {
    const code = (e as { code?: string; errorCode?: string }).code ?? (e as { errorCode?: string }).errorCode;
    database = { ok: false, erreur: code ? `Prisma ${code}` : (e as Error).name };
  }
  const ok = config.length === 0 && database.ok;
  return NextResponse.json(
    {
      ok,
      configuration: config.length === 0 ? "ok" : config,
      baseDeDonnees: database,
      variables: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        DIRECT_URL: Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED),
        TEST_END_DATE: Boolean(process.env.TEST_END_DATE),
        EDITEUR_NOM: Boolean(process.env.EDITEUR_NOM),
        APP_URL: Boolean(process.env.APP_URL),
      },
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
