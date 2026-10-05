import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { auditFacets, listAudit } from "@/server/operateur/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterForm, pickEnum } from "@/components/operateur/filter-form";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("OPERATEUR");
  const sp = await searchParams;
  const facets = await auditFacets();
  // Filtres limités aux valeurs connues (aucune saisie libre envoyée à la base).
  const action = pickEnum(sp.action, facets.actions);
  const entityType = pickEnum(sp.entite, facets.entityTypes);
  const rows = await listAudit({ action, entityType });

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Journal d'audit"
        description="Lecture seule. Chaque action sensible laisse une trace : qui, quoi, quand."
      />
      <FilterForm
        action="/operateur/journal-audit"
        fields={[
          { name: "action", label: "Action", value: action, options: facets.actions.map((a) => ({ value: a, label: a })), all: "Toutes" },
          { name: "entite", label: "Entité", value: entityType, options: facets.entityTypes.map((e) => ({ value: e, label: e })), all: "Toutes" },
        ]}
      />
      <p className="mb-3 text-muted" role="status">
        {rows.length} entrée(s){rows.length === 200 ? " (les 200 plus récentes)" : ""}.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Aucune entrée pour ces filtres." />
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-card">
          <table className="w-full min-w-[48rem] border-collapse text-left text-[15px]">
            <caption className="sr-only">Entrées du journal d&apos;audit, de la plus récente à la plus ancienne</caption>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className="px-4 py-3 text-[12.5px] font-semibold tracking-[.08em] text-muted uppercase">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 text-[12.5px] font-semibold tracking-[.08em] text-muted uppercase">
                  Acteur
                </th>
                <th scope="col" className="px-4 py-3 text-[12.5px] font-semibold tracking-[.08em] text-muted uppercase">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 text-[12.5px] font-semibold tracking-[.08em] text-muted uppercase">
                  Entité
                </th>
                <th scope="col" className="px-4 py-3 text-[12.5px] font-semibold tracking-[.08em] text-muted uppercase">
                  Détails
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((a) => (
                <tr key={a.id} className="align-top hover:bg-surface-2/40">
                  <td className="num px-4 py-3 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    {a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : "Système"}
                    {a.actorRole ? <span className="block text-muted">{ROLE_LABELS[a.actorRole]}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono">{a.action}</code>
                  </td>
                  <td className="px-4 py-3">
                    {a.entityType}
                    {a.entityId ? <span className="block font-mono text-xs break-all text-muted">{a.entityId}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {a.metadata ? <code className="font-mono text-xs break-all">{JSON.stringify(a.metadata)}</code> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
