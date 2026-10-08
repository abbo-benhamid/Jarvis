import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { listActivations } from "@/server/offre/activation";
import { handleActivationAction } from "@/server/offre/actions";
import { logAudit } from "@/server/audit";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/operateur/display";
import { OpsAction } from "@/components/operateur/ops-action";
import { getPlan } from "@/lib/plans";
import { communeLabel } from "@/lib/communes";
import { formatDateTime } from "@/lib/format";
import { creneauLabelOperateur } from "@/lib/rappel";

export const metadata: Metadata = { title: "Demandes de rappel" };
export const dynamic = "force-dynamic";

/**
 * L4 / R8 : demandes de rappel pour une formule payante. Le conseiller appelle la famille.
 * J32 : AUCUN encaissement tant que les CGV ne sont pas publiées. Le conseiller explique, il ne vend pas.
 */
export default async function Page() {
  const user = await requireRole("OPERATEUR");
  const rows = await listActivations();
  if (rows.length > 0) await logAudit({ actor: user, action: "plan.activation_viewed", entityType: "PlanActivationRequest", metadata: { count: rows.length } });
  return (
    <>
      <PageHeader
        eyebrow="Formules"
        title="Demandes de rappel"
        description="Une famille veut être appelée : pour une formule, ou pour poser une question. Appelez-la dans le créneau choisi. N'encaissez rien : les conditions de vente ne sont pas encore publiées."
      />
      {rows.length === 0 ? (
        <EmptyState title="Aucune demande en attente." />
      ) : (
        <DataTable
          minWidth="52rem"
          head={["Date", "Famille", "À appeler", "Sujet", "Aîné", "État", "Action"]}
          rows={rows.map((r) => [
            formatDateTime(r.createdAt),
            `${r.user.firstName} ${r.user.lastName}`,
            <span key="c" className="text-[15px]">
              <strong className="font-semibold">{r.phone ?? r.user.phone ?? "pas de téléphone"}</strong>
              <br />
              {creneauLabelOperateur(r.creneau)}
              <br />
              <span className="text-sm text-muted">{r.user.email}</span>
            </span>,
            r.plan ? `Formule ${getPlan(r.plan).name}` : "Question",
            r.aine ? `${r.aine.firstName} (${communeLabel(r.aine.commune)})` : "—",
            r.status === "NOUVELLE" ? <Badge key="s" tone="soleil">À appeler</Badge> : <Badge key="s" tone="mer">Appel fait</Badge>,
            <div key="a" className="flex flex-col gap-2">
              {r.status === "NOUVELLE" ? <OpsAction action={handleActivationAction} fields={{ id: r.id, status: "RAPPELEE" }} label="Appel fait" /> : null}
              <OpsAction action={handleActivationAction} fields={{ id: r.id, status: "CLOSE" }} label="Clore" variant="quiet" />
            </div>,
          ])}
        />
      )}
    </>
  );
}
