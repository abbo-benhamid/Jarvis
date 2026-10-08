import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { CALL_REASON_LABELS, listCaregiversToCall, CAREGIVER_STALE_HOURS } from "@/server/operateur/files-lancement";
import { logAudit } from "@/server/audit";
import { ageLabel } from "@/server/operateur/rules";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ValidationBadge } from "@/components/status-badges";
import { BackLink, DataTable } from "@/components/operateur/display";
import { CAREGIVER_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Accompagnants à appeler" };
export const dynamic = "force-dynamic";

/**
 * L1d (D15, UX B3) : file « Accompagnants à appeler ».
 * L'accompagnante fait son orientation et sa demande de vérification dans l'app. Le conseiller l'appelle :
 * vérification demandée, ou profil resté incomplet plus de 48 h (elle attend peut-être sans savoir quoi faire).
 */
export default async function Page() {
  const user = await requireRole("OPERATEUR");
  const rows = await listCaregiversToCall();
  if (rows.length > 0) await logAudit({ actor: user, action: "caregiver.to_call_viewed", entityType: "CaregiverProfile", metadata: { count: rows.length } });
  return (
    <>
      <BackLink href="/operateur/accompagnants">Tous les accompagnants</BackLink>
      <PageHeader
        eyebrow="Accompagnants"
        title="Accompagnants à appeler"
        description={`Appelez chaque personne. Vérification demandée : faites l'entretien. Orientation faite : aidez-la à finir son profil. Inscrite depuis plus de ${CAREGIVER_STALE_HOURS} h sans orientation : expliquez la suite.`}
      />
      {rows.length === 0 ? (
        <EmptyState title="Personne à appeler." />
      ) : (
        <DataTable
          minWidth="48rem"
          head={["Inscrit", "Nom", "À appeler", "Où en est-il ?", "Action"]}
          rows={rows.map((c) => {
            const declared = c.verifications.filter((v) => v.status !== "A_FOURNIR").length;
            return [
              ageLabel(c.createdAt),
              `${c.user.firstName} ${c.user.lastName}`,
              <span key="t" className="text-[15px]">
                <strong className="font-semibold">{c.user.phone ?? "pas de téléphone"}</strong>
                <br />
                <span className="text-sm text-muted">{c.user.email}</span>
              </span>,
              <span key="s" className="flex flex-col gap-1">
                <ValidationBadge status={c.validation} />
                <span className="text-[15px] font-semibold">{CALL_REASON_LABELS[c.raison]}</span>
                <span className="text-sm text-muted">
                  {c.status ? `${CAREGIVER_STATUS_LABELS[c.status]}. ` : ""}
                  {c.validation === "EN_ATTENTE" ? `${declared} pièce(s) déclarée(s) ou vérifiée(s).` : null}
                </span>
              </span>,
              <Link key="a" href={`/operateur/accompagnants/${c.id}`} className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
                Ouvrir la fiche
              </Link>,
            ];
          })}
        />
      )}
    </>
  );
}
