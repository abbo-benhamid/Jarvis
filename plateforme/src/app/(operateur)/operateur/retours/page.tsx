import type { Metadata } from "next";
import type { FeedbackStatus } from "@prisma/client";
import { requireRole } from "@/server/auth/guards";
import { feedbackCounts, listFeedback } from "@/server/operateur/queries";
import { FEEDBACK_STATUS_LABELS, RATING_LABELS } from "@/server/operateur/rules";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { FilterForm, pickEnum } from "@/components/operateur/filter-form";
import { KpiTile } from "@/components/operateur/display";
import { FeedbackStatusForm } from "@/components/operateur/forms";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Retours testeurs" };
export const dynamic = "force-dynamic";

const STATUSES = Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[];
const TONE: Record<FeedbackStatus, BadgeTone> = { NOUVEAU: "soleil", LU: "mer", TRAITE: "feuille" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("OPERATEUR");
  const sp = await searchParams;
  const status = pickEnum(sp.statut, STATUSES);
  const [rows, stats] = await Promise.all([listFeedback({ status }), feedbackCounts()]);

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Retours testeurs"
        description="Lisez chaque retour. Marquez-le « Lu », puis « Traité » quand une action est faite ou décidée."
        actions={
          <a href="/operateur/retours/export" className={buttonClasses("secondary")} download>
            Télécharger (CSV)
          </a>
        }
      />
      <dl className="m-0 mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <KpiTile key={s} label={FEEDBACK_STATUS_LABELS[s]} value={stats.counts[s]} />
        ))}
        <KpiTile label="Note moyenne" value={stats.average != null ? `${stats.average.toFixed(1).replace(".", ",")}/5` : "—"} />
      </dl>
      <FilterForm
        action="/operateur/retours"
        fields={[{ name: "statut", label: "Statut", value: status, options: STATUSES.map((s) => ({ value: s, label: FEEDBACK_STATUS_LABELS[s] })) }]}
      />
      <p className="mb-3 text-muted" role="status">
        {rows.length} retour(s).
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Aucun retour pour ce filtre.">Les testeurs envoient leur avis avec le bouton « Donner mon avis ».</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((f) => {
            const titleId = `retour-${f.id}`;
            return (
              <li key={f.id}>
                <article aria-labelledby={titleId} className="rounded-card bg-surface p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id={titleId} className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
                      Note {f.rating}/5 — {RATING_LABELS[f.rating]}
                    </h2>
                    <Badge tone={TONE[f.status]}>{FEEDBACK_STATUS_LABELS[f.status]}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-line">{f.message}</p>
                  <p className="mt-2 text-sm text-muted">
                    Page <code className="font-mono">{f.pagePath}</code> · {f.role ? ROLE_LABELS[f.role] : "Visiteur non connecté"}
                    {f.user ? ` (${f.user.firstName} ${f.user.lastName})` : ""} · {formatDateTime(f.createdAt)}
                    {f.testerCode ? ` · code testeur ${f.testerCode}` : ""}
                  </p>
                  <div className="mt-3">
                    <FeedbackStatusForm feedbackId={f.id} current={f.status} />
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
