import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { listAinesForAccord, SITUATION_LABELS } from "@/server/operateur/accord";
import { logAudit } from "@/server/audit";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NOTICE_FALC, NOTICE_FALC_VERSION } from "@/lib/legal-launch";
import { communeLabel } from "@/lib/communes";
import { formatDateTime } from "@/lib/format";
import { AccordForm } from "./accord-form";

export const metadata: Metadata = { title: "Accord des aînés" };
export const dynamic = "force-dynamic";

const STATE: Record<string, { label: string; tone: BadgeTone }> = {
  EN_ATTENTE_ACCORD: { label: "À appeler", tone: "soleil" },
  ACCORD_RECUEILLI: { label: "Accord recueilli", tone: "feuille" },
  ACCORD_REFUSE: { label: "Refus", tone: "hibiscus" },
  ACCORD_RETIRE: { label: "Accord retiré", tone: "hibiscus" },
};

/**
 * R5 (J5) : le conseiller appelle l'aîné, lit la notice FALC mot pour mot, puis enregistre la réponse.
 * La famille ne donne jamais l'accord à la place de l'aîné.
 */
export default async function Page() {
  const user = await requireRole("OPERATEUR");
  const rows = await listAinesForAccord();
  if (rows.length > 0) await logAudit({ actor: user, action: "aine.accord_list_viewed", entityType: "Aine", metadata: { count: rows.length } });
  return (
    <>
      <PageHeader eyebrow="Aînés" title="Accord des aînés" description="Appelez l'aîné. Lisez la notice. Enregistrez sa réponse. L'aîné peut dire non, ou arrêter plus tard." />
      <Card className="mb-5">
        <CardTitle>Notice à lire ({NOTICE_FALC_VERSION})</CardTitle>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[15px]">
          {NOTICE_FALC.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted">Réponses possibles : oui, non, « je veux en parler à quelqu&apos;un » (rappelez plus tard).</p>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="Aucun aîné à appeler." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="mb-0">
                    {a.firstName} · {communeLabel(a.commune)}
                  </CardTitle>
                  <Badge tone={STATE[a.accordEtat]!.tone}>{STATE[a.accordEtat]!.label}</Badge>
                </div>
                <p className="text-[15px]">
                  Téléphone de l&apos;aîné : <strong>{a.phone ?? "non donné"}</strong> · Famille : {a.owner.firstName} {a.owner.lastName}
                  {a.owner.phone ? ` (${a.owner.phone})` : ""} · Fiche créée le {formatDateTime(a.createdAt)}
                  {a.accordAt && a.accordEtat !== "EN_ATTENTE_ACCORD" ? ` · Réponse du ${formatDateTime(a.accordAt)}` : ""}
                </p>
                {a.accordEtat === "ACCORD_REFUSE" || a.accordEtat === "ACCORD_RETIRE" ? null : (
                  <AccordForm aineId={a.id} recueilli={a.accordEtat === "ACCORD_RECUEILLI"} situations={SITUATION_LABELS} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
