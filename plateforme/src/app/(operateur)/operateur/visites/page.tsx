import type { Metadata } from "next";
import type { VisitStatus } from "@prisma/client";
import { requireRole } from "@/server/auth/guards";
import { z } from "zod";
import { getVisitSummary, listVisits, visitStatusCounts } from "@/server/operateur/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { VisitStatusBadge } from "@/components/status-badges";
import { ProofFactors } from "@/components/operateur/display";
import { FilterForm, pickEnum } from "@/components/operateur/filter-form";
import { ConfirmElderForm } from "@/components/operateur/forms";
import { VISIT_STATUS_LABELS, proofCountLabel } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";
import { formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Visites" };
export const dynamic = "force-dynamic";

const STATUSES = Object.keys(VISIT_STATUS_LABELS) as VisitStatus[];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("OPERATEUR");
  const sp = await searchParams;
  const status = pickEnum(sp.statut, STATUSES);
  const signal = pickEnum(sp.signal, ["surveiller"] as const) === "surveiller";
  const confirmedId = typeof sp.confirme === "string" && z.string().cuid().safeParse(sp.confirme).success ? sp.confirme : null;
  const [visits, counts, confirmed] = await Promise.all([
    listVisits({ status, signal }),
    visitStatusCounts(),
    confirmedId ? getVisitSummary(confirmedId) : null,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Visites"
        description="Une visite est validée avec 2 preuves sur 3. Pour une visite à vérifier, appelez l'aîné ou la famille."
      />
      {confirmed ? (
        <Alert tone={confirmed.status === "VALIDEE" ? "succes" : "attention"} title="Appel simulé enregistré" className="mb-6">
          Visite chez {confirmed.aine.firstName} du {formatDate(confirmed.scheduledStart)} : statut « {VISIT_STATUS_LABELS[confirmed.status]} »,{" "}
          {proofCountLabel(confirmed.proofScore)}. Le message vocal simulé est dans la boîte d&apos;envoi.
        </Alert>
      ) : null}
      <p className="mb-4 flex flex-wrap gap-2" aria-label="Nombre de visites par statut">
        {STATUSES.map((s) => (
          <Badge key={s} tone="neutre">
            {VISIT_STATUS_LABELS[s]} : {counts[s] ?? 0}
          </Badge>
        ))}
      </p>
      <FilterForm
        action="/operateur/visites"
        fields={[
          { name: "statut", label: "Statut", value: status, options: STATUSES.map((s) => ({ value: s, label: VISIT_STATUS_LABELS[s] })) },
          {
            name: "signal",
            label: "Kayé",
            value: signal ? "surveiller" : undefined,
            options: [{ value: "surveiller", label: "Avec signal « à surveiller »" }],
            all: "Tous",
          },
        ]}
      />
      <p className="mb-3 text-muted" role="status">
        {visits.length} visite(s){visits.length === 100 ? " (les 100 plus récentes)" : ""}.
      </p>
      {visits.length === 0 ? (
        <EmptyState title="Aucune visite pour ces filtres." />
      ) : (
        <ul className="flex flex-col gap-3">
          {visits.map((v) => {
            const titleId = `visite-${v.id}`;
            const canConfirm =
              (v.status === "EN_COURS" || v.status === "A_VERIFIER") && !v.proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid);
            return (
              <li key={v.id}>
                <article aria-labelledby={titleId} className="rounded-card bg-surface p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id={titleId} className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
                      {v.aine.firstName} {v.aine.lastInitial ?? ""} — {formatDate(v.scheduledStart)}, {formatTime(v.scheduledStart)}
                    </h2>
                    <span className="flex flex-wrap gap-1">
                      <VisitStatusBadge status={v.status} />
                      {v.journal?.alertFlag ? <Badge tone="soleil">Kayé à surveiller</Badge> : null}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {communeLabel(v.aine.commune)} · accompagnant : {v.caregiver.user.firstName} {v.caregiver.user.lastName}
                    {v.checkInAt ? ` · arrivée ${formatTime(v.checkInAt)}` : ""}
                    {v.checkOutAt ? ` · départ ${formatTime(v.checkOutAt)}` : ""}
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <p className="font-semibold">{proofCountLabel(v.proofScore)}</p>
                      <ProofFactors proofs={v.proofs} />
                      {v.journal?.alertFlag && v.journal.alertNote ? (
                        <p className="mt-2">
                          <span className="font-semibold">Signal (non médical) : </span>« {v.journal.alertNote} »
                        </p>
                      ) : null}
                      {v.status === "VALIDEE" || v.status === "A_VERIFIER" ? (
                        <p className="mt-1 text-sm text-muted">{v.journal ? "Kayé écrit." : "Kayé pas encore écrit."}</p>
                      ) : null}
                    </div>
                    {canConfirm ? <ConfirmElderForm visitId={v.id} /> : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
