import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { listUnverifiedAccounts } from "@/server/operateur/accord";
import { verifyEmailManuallyAction } from "@/server/operateur/comptes-actions";
import { mailDeliveryConfigured } from "@/server/mail";
import { logAudit } from "@/server/audit";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/operateur/display";
import { OpsAction } from "@/components/operateur/ops-action";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Comptes" };
export const dynamic = "force-dynamic";

/**
 * L3 : comptes dont l'adresse e-mail n'est pas confirmée. Validation manuelle (J31) seulement après un appel
 * au numéro du compte. Un compte jamais confirmé est effacé après 7 jours (J29).
 */
export default async function Page() {
  const user = await requireRole("OPERATEUR");
  const rows = await listUnverifiedAccounts();
  if (rows.length > 0) await logAudit({ actor: user, action: "account.unverified_viewed", entityType: "User", metadata: { count: rows.length } });
  return (
    <>
      <PageHeader
        eyebrow="Comptes"
        title="E-mails à confirmer"
        description="Ces personnes n'ont pas encore confirmé leur adresse e-mail. Sans confirmation, le compte est effacé après 7 jours."
      />
      {mailDeliveryConfigured() ? null : (
        <Alert tone="attention" title="Les e-mails ne partent pas encore. Appelez la personne.">
          Appelez la personne au numéro du compte. Vérifiez son nom et son adresse e-mail. Ensuite seulement, validez l&apos;adresse ici.
        </Alert>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Tous les comptes ont une adresse confirmée." />
      ) : (
        <DataTable
          minWidth="48rem"
          head={["Créé le", "Nom", "Rôle", "Contact", "Action"]}
          rows={rows.map((r) => [
            formatDateTime(r.createdAt),
            `${r.firstName} ${r.lastName}`,
            ROLE_LABELS[r.role],
            <span key="c" className="text-sm">
              {r.phone ?? "pas de téléphone"}
              <br />
              {r.email}
            </span>,
            r.phone ? (
              <OpsAction
                key="a"
                action={verifyEmailManuallyAction}
                fields={{ userId: r.id }}
                label="Valider l'adresse"
                confirm="J'ai appelé la personne au numéro du compte. Elle confirme son nom et cette adresse."
              />
            ) : (
              <a key="a" href={`mailto:${r.email}`} className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
                Écrire à la personne
              </a>
            ),
          ])}
        />
      )}
    </>
  );
}
