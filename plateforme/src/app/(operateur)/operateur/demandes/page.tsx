import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { listOpenRequests } from "@/server/operateur/queries";
import { ageInDays, ageLabel, STALE_REQUEST_DAYS } from "@/server/operateur/rules";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LevelBadge, RequestStatusBadge } from "@/components/status-badges";
import { SlotList } from "@/components/operateur/display";
import { FREQUENCY_LABELS } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";

export const metadata: Metadata = { title: "Demandes à matcher" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole("OPERATEUR");
  const rows = await listOpenRequests();
  const open = rows.filter((r) => r.status === "OUVERTE");
  const proposed = rows.filter((r) => r.status === "PROPOSEE");

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Demandes à matcher"
        description="Les plus anciennes d'abord. Ouvrez une demande pour voir les accompagnants compatibles."
      />
      {rows.length === 0 ? (
        <EmptyState title="Aucune demande en cours.">Les nouvelles demandes des familles apparaissent ici.</EmptyState>
      ) : (
        <>
          <RequestList title="Ouvertes : aucune proposition" rows={open} empty="Aucune demande ouverte." />
          <RequestList title="Propositions envoyées : en attente de réponse" rows={proposed} empty="Aucune proposition en attente." />
        </>
      )}
    </>
  );
}

function RequestList({ title, rows, empty }: { title: string; rows: Awaited<ReturnType<typeof listOpenRequests>>; empty: string }) {
  const id = `t-${title.slice(0, 8).replace(/\W/g, "")}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-3 font-display text-[24px] leading-tight font-normal tracking-[-.015em]">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const waiting = r.proposals.filter((p) => p.status === "EN_ATTENTE").length;
            const stale = r.status === "OUVERTE" && ageInDays(r.createdAt) >= STALE_REQUEST_DAYS;
            return (
              <li key={r.id} className="rounded-card bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/operateur/demandes/${r.id}`} className="inline-flex min-h-11 items-center text-lg font-semibold text-mer no-underline hover:underline">
                    {r.aine.firstName} {r.aine.lastInitial ?? ""} · {communeLabel(r.aine.commune)}
                  </Link>
                  <span className="flex flex-wrap gap-1">
                    <RequestStatusBadge status={r.status} />
                    {stale ? <Badge tone="hibiscus">Ancienne : à traiter</Badge> : null}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <LevelBadge level={r.level} /> {FREQUENCY_LABELS[r.frequency]}
                </p>
                <p className="text-sm text-muted">
                  Créneaux : <SlotList slots={r.slots} /> · créée {ageLabel(r.createdAt)}
                  {r.status === "PROPOSEE" ? ` · ${waiting} proposition(s) sans réponse` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
