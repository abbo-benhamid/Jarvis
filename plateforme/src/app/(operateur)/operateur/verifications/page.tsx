import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { DOUBT_LABELS, listReviewQueue, REFUSAL_LABELS } from "@/server/verifications/review";
import { L2_LABELS } from "@/server/verifications/rules";
import { ageLabel } from "@/server/operateur/rules";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/operateur/display";
import { AppealDecisionForm } from "@/components/operateur/verification-review";

export const metadata: Metadata = { title: "Vérifications à revoir" };
export const dynamic = "force-dynamic";

const RECOURS: Record<string, string> = {
  ERREUR_SUR_UN_DOCUMENT: "Erreur sur un document",
  NOUVEAU_DOCUMENT: "Nouveau document",
  SITUATION_CHANGEE: "Situation changée",
  AUTRE: "Autre raison",
};

function why(i: { status: string; method: string | null; decisionCode: string | null; refusalProposedAt: Date | null; documents: unknown[] }): string {
  if (i.refusalProposedAt) return `Refus proposé (${REFUSAL_LABELS[i.decisionCode ?? ""] ?? "motif"}) : second avis attendu.`;
  if (i.status === "DECLARE" && i.method === "VISIO") return "Visio demandée : appelez pour fixer l'heure.";
  if (i.documents.length > 0) return "Document à relire.";
  return DOUBT_LABELS[i.decisionCode ?? ""] ?? "Doute : revue humaine.";
}

/**
 * L2 (étude § 8.5) : file « Vérifications à revoir », triée par ancienneté. Délai cible : 2 jours ouvrés.
 * Aucune donnée de santé, aucune image dans la liste.
 */
export default async function Page() {
  await requireRole("OPERATEUR");
  const q = await listReviewQueue();
  return (
    <>
      <PageHeader eyebrow="Accompagnants" title="Vérifications à revoir" description="Les plus anciennes d'abord. Délai cible : 2 jours ouvrés. Aucune machine ne refuse : vous décidez." />
      {q.budgetAlerts > 0 ? (
        <Alert tone="attention" title="Plafond SMS atteint" className="mb-4">
          Les codes par SMS sont suspendus jusqu&apos;à demain (SMS_DAILY_BUDGET_CENTS). Vérifiez s&apos;il s&apos;agit d&apos;une attaque, puis vérifiez les numéros par appel.
        </Alert>
      ) : null}
      {q.items.length === 0 ? (
        <EmptyState title="Aucun élément à revoir." />
      ) : (
        <DataTable
          minWidth="48rem"
          head={["Depuis", "Accompagnant", "Élément", "Pourquoi", "Action"]}
          rows={q.items.map((i) => [
            ageLabel(i.updatedAt),
            `${i.caregiver.user.firstName} ${i.caregiver.user.lastName}`,
            L2_LABELS[i.type],
            <span key="w" className="text-[15px]">
              {why(i)}
              {i.status === "DECLARE" && i.caregiver.visioCreneau ? <span className="block text-sm text-muted">Créneau : {i.caregiver.visioCreneau.toLowerCase().replace("_", "-")}. Téléphone : {i.caregiver.user.phone ?? "aucun"}.</span> : null}
            </span>,
            <Link key="a" href={`/operateur/verifications/${i.id}`} className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
              Revoir
            </Link>,
          ])}
        />
      )}

      <section aria-labelledby="t-refus" className="mt-8">
        <h2 id="t-refus" className="mb-3 font-sans text-[17px] font-semibold">
          Refus de profil à confirmer (second avis)
        </h2>
        {q.refusals.length === 0 ? (
          <p className="text-muted">Aucun.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {q.refusals.map((r) => (
              <li key={r.id}>
                <Link href={`/operateur/accompagnants/${r.id}`} className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
                  {r.user.firstName} {r.user.lastName} — {REFUSAL_LABELS[r.refusalCode ?? ""] ?? "motif"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-recours" className="mt-8">
        <h2 id="t-recours" className="mb-3 font-sans text-[17px] font-semibold">
          Demandes de réexamen (recours)
        </h2>
        {q.appeals.length === 0 ? (
          <p className="text-muted">Aucune.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {q.appeals.map((a) => (
              <Card key={a.id} className="flex flex-col gap-2">
                <CardTitle className="mb-0">
                  {a.caregiver.user.firstName} {a.caregiver.user.lastName}
                </CardTitle>
                <p className="text-[15px]">
                  Refus : {REFUSAL_LABELS[a.caregiver.refusalCode ?? ""] ?? "motif non noté"}. Raison du recours : {RECOURS[a.motif] ?? a.motif}. Demandé {ageLabel(a.createdAt).toLowerCase()}.
                </p>
                <Link href={`/operateur/accompagnants/${a.caregiver.id}`} className="font-semibold text-mer underline">
                  Ouvrir la fiche
                </Link>
                <p className="text-sm text-muted">Un autre opérateur que ceux du refus fait le réexamen, sous 7 jours.</p>
                <AppealDecisionForm appealId={a.id} />
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
