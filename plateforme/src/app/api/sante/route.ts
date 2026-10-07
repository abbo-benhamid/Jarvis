import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { configWarnings, productionConfigProblems, realDataAllowedFrom, siteMode } from "@/server/config-check";

export const dynamic = "force-dynamic";

/**
 * Diagnostic public minimal pour la mise en ligne : configuration et base de données.
 * Ne renvoie jamais de valeur secrète ni d'URL de connexion : seulement des noms et des codes d'erreur.
 * L1 : `mode` (lancement | essai), `donneesReelles` (R1), `avertissements` (L3, L12) : un avertissement
 * ne change PAS le statut (pas de 503 sans clé Brevo, par exemple).
 */
export async function GET() {
  const config = productionConfigProblems();
  const mode = siteMode();
  const warnings = configWarnings();
  let database: { ok: boolean; erreur?: string; migrations?: number } = { ok: false };
  try {
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    database = { ok: true, migrations: Number(rows[0]?.n ?? 0) };
    if (mode === "lancement") {
      // L11 : aucune donnée de démo ni de bac à sable en lancement (la purge nocturne efface les bacs à sable).
      const [demo, sandboxes] = await Promise.all([db.user.count({ where: { isDemo: true } }), db.sandbox.count()]);
      if (demo > 0) warnings.push(`${demo} compte(s) de démonstration en base : ils sont refusés en lancement. Effacez-les (voir docs/deploiement-vercel.md).`);
      if (sandboxes > 0) warnings.push(`${sandboxes} bac(s) à sable en base : la purge nocturne les efface.`);
    }
  } catch (e) {
    const code = (e as { code?: string; errorCode?: string }).code ?? (e as { errorCode?: string }).errorCode;
    database = { ok: false, erreur: code ? `Prisma ${code}` : (e as Error).name };
  }
  const ok = config.length === 0 && database.ok;
  return NextResponse.json(
    {
      ok,
      mode,
      donneesReelles: realDataAllowedFrom() ? "ouvertes" : "fermees (preinscription)",
      configuration: config.length === 0 ? "ok" : config,
      avertissements: warnings,
      baseDeDonnees: database,
      variables: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        DIRECT_URL: Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED),
        TEST_END_DATE: Boolean(process.env.TEST_END_DATE),
        EDITEUR_NOM: Boolean(process.env.EDITEUR_NOM),
        APP_URL: Boolean(process.env.APP_URL),
        BREVO_API_KEY: Boolean(process.env.BREVO_API_KEY),
        MAIL_FROM: Boolean(process.env.MAIL_FROM),
      },
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
