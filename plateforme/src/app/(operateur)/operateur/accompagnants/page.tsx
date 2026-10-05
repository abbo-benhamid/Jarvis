import type { Metadata } from "next";
import Link from "next/link";
import type { CaregiverStatus, CaregiverValidation } from "@prisma/client";
import { requireRole } from "@/server/auth/guards";
import { listCaregivers } from "@/server/operateur/queries";
import { ageLabel } from "@/server/operateur/rules";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ValidationBadge } from "@/components/status-badges";
import { FilterForm, pickEnum } from "@/components/operateur/filter-form";
import { CAREGIVER_STATUS_LABELS, VALIDATION_LABELS } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";

export const metadata: Metadata = { title: "Accompagnants" };
export const dynamic = "force-dynamic";

const VALIDATIONS = Object.keys(VALIDATION_LABELS) as CaregiverValidation[];
const STATUSES = Object.keys(CAREGIVER_STATUS_LABELS) as CaregiverStatus[];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("OPERATEUR");
  const sp = await searchParams;
  const validation = pickEnum(sp.validation, VALIDATIONS);
  const status = pickEnum(sp.statut, STATUSES);
  const rows = await listCaregivers({ validation, status });

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Accompagnants"
        description="Vérifiez chaque profil. Une décision de refus ou de suspension demande toujours un motif."
      />
      <FilterForm
        action="/operateur/accompagnants"
        fields={[
          {
            name: "validation",
            label: "Vérification",
            value: validation,
            options: VALIDATIONS.map((v) => ({ value: v, label: VALIDATION_LABELS[v] })),
            all: "Toutes",
          },
          { name: "statut", label: "Statut", value: status, options: STATUSES.map((s) => ({ value: s, label: CAREGIVER_STATUS_LABELS[s] })) },
        ]}
      />
      <p className="mb-3 text-muted" role="status">
        {rows.length} accompagnant(s).
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Aucun accompagnant pour ces filtres." />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => {
            const declared = c.verifications.filter((v) => v.status !== "A_FOURNIR").length;
            const valid = c.verifications.filter((v) => v.status === "VALIDE").length;
            return (
              <li key={c.id} className="rounded-card bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/operateur/accompagnants/${c.id}`} className="inline-flex min-h-11 items-center text-lg font-semibold text-mer no-underline hover:underline">
                    {c.user.firstName} {c.user.lastName}
                  </Link>
                  <ValidationBadge status={c.validation} />
                </div>
                <p>{c.status ? CAREGIVER_STATUS_LABELS[c.status] : "Orientation statut non faite"}</p>
                <p className="text-sm text-muted">
                  Niveaux : {c.allowedLevels.length ? c.allowedLevels.join(", ") : "aucun"} · Communes :{" "}
                  {c.communes.length ? c.communes.map(communeLabel).join(", ") : "aucune"}
                </p>
                <p className="text-sm text-muted">
                  Vérifications : {valid} validée(s), {declared} déclarée(s) sur {c.verifications.length} · mis à jour {ageLabel(c.updatedAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
