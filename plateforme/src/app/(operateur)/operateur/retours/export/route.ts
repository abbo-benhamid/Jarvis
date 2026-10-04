import { requireRole } from "@/server/auth/guards";
import { listFeedback } from "@/server/operateur/queries";
import { csvCell, FEEDBACK_STATUS_LABELS } from "@/server/operateur/rules";
import { logAudit } from "@/server/audit";
import { ROLE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Export CSV des retours testeurs (analyse dans un tableur). Opérateur seulement, audité. */
export async function GET() {
  const user = await requireRole("OPERATEUR");
  const rows = await listFeedback({});
  await logAudit({ actor: user, action: "feedback.export", entityType: "Feedback", metadata: { count: rows.length } });
  const header = ["date", "statut", "note", "role", "page", "message"].map(csvCell).join(";");
  const lines = rows.map((f) =>
    [f.createdAt.toISOString(), FEEDBACK_STATUS_LABELS[f.status], f.rating, f.role ? ROLE_LABELS[f.role] : "Visiteur", f.pagePath, f.message]
      .map(csvCell)
      .join(";"),
  );
  // BOM UTF-8 pour un affichage correct des accents dans les tableurs.
  const body = "﻿" + [header, ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="koudmen-retours-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
