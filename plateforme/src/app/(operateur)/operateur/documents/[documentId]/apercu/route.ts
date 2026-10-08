import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { openDocumentForReview } from "@/server/verifications/review";

export const dynamic = "force-dynamic";

const motifSchema = z.enum(["REVUE_DOSSIER", "RECOURS", "CONTROLE_QUALITE"]);

/**
 * L2 (étude § 7.2) : GET /operateur/documents/{id}/apercu?motif=REVUE_DOSSIER — le serveur déchiffre et envoie le fichier.
 * Opérateur réel seulement ; motif OBLIGATOIRE (liste fermée) ; chaque ouverture écrit DocumentAccessLog + AuditLog.
 * Aucune URL publique ni signée ; `no-store` ; affichage `inline` (pas de téléchargement proposé par le site).
 * [À VÉRIFIER] 2FA opérateur (TOTP) prévue, pas encore en place ; filigrane posé par la page d'aperçu (calque), pas
 * incrusté dans le fichier.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ documentId: string }> }) {
  const user = await requireRole("OPERATEUR");
  const { documentId } = await ctx.params;
  const motif = motifSchema.safeParse(req.nextUrl.searchParams.get("motif"));
  if (!motif.success) return NextResponse.json({ erreur: "Choisissez le motif d'accès." }, { status: 400 });
  if (!z.string().min(10).max(40).regex(/^[a-z0-9]+$/).safeParse(documentId).success) return new NextResponse(null, { status: 404 });
  const doc = await openDocumentForReview(user, documentId, motif.data);
  if (!doc) return NextResponse.json({ erreur: "Document effacé ou introuvable." }, { status: 404 });
  return new NextResponse(new Uint8Array(doc.bytes), {
    status: 200,
    headers: {
      "content-type": doc.mime,
      "content-disposition": "inline",
      "cache-control": "no-store, private",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      // [À VÉRIFIER] Visionneuse PDF de Chrome avec cette politique (object-src 'self').
      "content-security-policy": doc.mime === "application/pdf" ? "default-src 'none'; object-src 'self'; img-src 'self'; style-src 'unsafe-inline'" : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
