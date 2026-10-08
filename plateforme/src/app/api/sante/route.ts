import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { brevoHealth } from "@/server/mail/brevo";
import { configWarnings, productionConfigProblems, realDataAllowedFrom, siteMode } from "@/server/config-check";
import { verificationServicesState } from "@/server/verifications/config";
import { redactionFailures } from "@/server/verifications/review";

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
  let redactFailures: number | null = null;
  try {
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    database = { ok: true, migrations: Number(rows[0]?.n ?? 0) };
    // L2b (M4) : suppressions chez le prestataire d'identité en échec depuis 3 nuits (biométrie gardée trop longtemps).
    redactFailures = await redactionFailures();
    if (redactFailures > 0) warnings.push(`${redactFailures} suppression(s) des images et de la biométrie chez le prestataire d'identité échouent depuis 3 nuits. Vérifiez les clés et prévenez le DPO.`);
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
  // L1d : la clé Brevo est-elle acceptée ? (lecture du compte, aucun envoi, aucune donnée du compte renvoyée).
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const brevo = brevoKey ? await brevoHealth(brevoKey) : null;
  if (brevo && !brevo.cleAcceptee) {
    warnings.push(brevo.repond ? `Brevo refuse la clé (HTTP ${brevo.statut}) : aucun e-mail ne part.` : "Brevo ne répond pas : les e-mails peuvent ne pas partir.");
  }
  // Un problème d'e-mail ne coupe pas le site (pas de 503) : avertissement seulement.
  const ok = config.length === 0 && database.ok;
  return NextResponse.json(
    {
      ok,
      mode,
      donneesReelles: realDataAllowedFrom() ? "ouvertes" : "fermees (preinscription)",
      configuration: config.length === 0 ? "ok" : config,
      avertissements: warnings,
      baseDeDonnees: database,
      email: brevo ? { adaptateur: "brevo", repond: brevo.repond, cleAcceptee: brevo.cleAcceptee } : { adaptateur: "console", repond: false, cleAcceptee: false },
      // L2 : adaptateur et ouverture de chaque service de vérification (aucune valeur secrète). Jamais de 503 pour ces clés.
      verifications: { ...verificationServicesState(), suppressionsPrestataireEnEchec: redactFailures },
      variables: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        DIRECT_URL: Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED),
        TEST_END_DATE: Boolean(process.env.TEST_END_DATE),
        EDITEUR_NOM: Boolean(process.env.EDITEUR_NOM),
        APP_URL: Boolean(process.env.APP_URL),
        BREVO_API_KEY: Boolean(process.env.BREVO_API_KEY),
        MAIL_FROM: Boolean(process.env.MAIL_FROM),
        BREVO_SMS_SENDER: Boolean(process.env.BREVO_SMS_SENDER),
        VERIFF_API_KEY: Boolean(process.env.VERIFF_API_KEY),
        VERIFF_SHARED_SECRET: Boolean(process.env.VERIFF_SHARED_SECRET),
        STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
        STRIPE_IDENTITY_WEBHOOK_SECRET: Boolean(process.env.STRIPE_IDENTITY_WEBHOOK_SECRET),
        TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID),
        INSEE_API_KEY: Boolean(process.env.INSEE_API_KEY),
        DOCUMENT_ENC_KEY: Boolean(process.env.DOCUMENT_ENC_KEY),
        VERIFICATION_HMAC_KEY: Boolean(process.env.VERIFICATION_HMAC_KEY),
      },
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
