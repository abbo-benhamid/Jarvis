import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines, getPlanContext } from "@/server/famille/queries";
import { formatDateTime, formatEuros, fullName } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTabs } from "@/components/famille/filter-tabs";
import { PlanChooser } from "@/components/famille/plan-chooser";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { OFFER_TEST_NOTICE } from "@/lib/plans";
import { DISCOVERY_PRICE_LABEL } from "@/lib/measure";

export const metadata: Metadata = { title: "Formule" };

/** F9 : formules (paiement simulé). Seul le payeur change la formule (RM-14). */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine: aineParam } = await searchParams;
  const aines = await getFamilyAines(user.id);

  if (aines.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Formule" title="Les formules" />
        <EmptyState title="Ajoutez d'abord un aîné" action={<LinkButton href="/famille/aines/nouveau">Ajouter un aîné</LinkButton>}>
          La formule Lakou (gratuite) est activée dès la création du profil.
        </EmptyState>
      </>
    );
  }

  const selectedId = aines.find((a) => a.id === aineParam)?.id ?? aines[0]!.id;
  const ctx = await getPlanContext(user, selectedId);
  if (!ctx) return null;
  const { aine, isPayer, payments } = ctx;
  const payer = aine.members.find((m) => m.isPayer);

  return (
    <>
      <PageHeader eyebrow="Formule" title={`La formule de ${aine.firstName}`} description="Choisissez le niveau de veille. Vous pouvez changer à tout moment." />
      <div className="flex flex-col gap-6">
        <Alert tone="attention" title={OFFER_TEST_NOTICE}>
          Version de test : le paiement est simulé. Aucune carte n&apos;est demandée, aucun argent n&apos;est prélevé. Les heures
          d&apos;accompagnement se paient à part, à l&apos;accompagnant ; Koudmen vous donne un relevé d&apos;heures et vous déclarez
          vous-même (CESU).
        </Alert>

        {aines.length > 1 ? (
          <FilterTabs
            label="Choisir l'aîné"
            tabs={aines.map((a) => ({ href: `/famille/formule?aine=${a.id}`, label: a.firstName, active: a.id === selectedId }))}
          />
        ) : null}

        {!isPayer ? (
          <Alert tone="info">
            Seul le payeur change la formule. Ici, le payeur est {payer ? fullName(payer.user) : "un autre membre du cercle"}.
          </Alert>
        ) : null}

        <PlanChooser aineId={aine.id} current={aine.subscription?.plan ?? null} canChange={isPayer} />

        <MicroQuestion user={user} questionKey="PRIX_TROP_CHER" path="/famille/formule" />

        <Card className="flex flex-col items-start gap-2 border-mer">
          <CardTitle>Une vraie visite découverte ({DISCOVERY_PRICE_LABEL})</CardTitle>
          <p>Vous voulez essayer pour de vrai, avec votre parent ? Dites-le nous : nous vous recontacterons.</p>
          <LinkButton href="/famille/visite-decouverte">Réserver une vraie visite découverte</LinkButton>
        </Card>

        {isPayer ? (
          <Card>
            <CardTitle>Paiements simulés</CardTitle>
            {payments.length === 0 ? (
              <p className="text-muted">Aucun paiement simulé pour le moment.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{formatDateTime(p.createdAt)}</span>
                    <span className="font-semibold">
                      {formatEuros(p.amountCents)} · {p.status === "SIMULE_REUSSI" ? "simulé, réussi" : "simulé, échec"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
