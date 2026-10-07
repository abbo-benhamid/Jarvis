import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines, getPlanContext } from "@/server/famille/queries";
import { deName, formatDateTime, formatEuros, fullName } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTabs } from "@/components/famille/filter-tabs";
import { PlanChooser } from "@/components/famille/plan-chooser";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { OFFER_TEST_NOTICE } from "@/lib/plans";
import { Term } from "@/components/ui/term";
import { DISCOVERY_PRICE_LABEL } from "@/lib/measure";
import { NO_PAYMENT_NOTICE, PLANS, priceLines } from "@/lib/plans";
import { isLaunchMode } from "@/server/launch";
import { openActivationsFor } from "@/server/offre/activation";
import { CallbackRequest } from "@/components/famille/callback-request";

export const metadata: Metadata = { title: "Formule" };

/**
 * F9 : formules. Seul le payeur change la formule (RM-14).
 * L4 / R8 : en lancement, aucun paiement (ni réel, ni simulé) ; une formule payante = demande de rappel
 * (« Activation par un conseiller Koudmen »). Sans fiche aîné (préinscription), la demande se fait sans aîné.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine: aineParam } = await searchParams;
  const aines = await getFamilyAines(user.id);
  const launch = isLaunchMode();
  const requested = launch ? await openActivationsFor(user.id) : [];

  if (launch && aines.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Formule" title="Les formules" description="Activation par un conseiller Koudmen." />
        <div className="flex flex-col gap-4">
          <Alert tone="info" title="Aucun paiement aujourd'hui">
            {NO_PAYMENT_NOTICE}
          </Alert>
          {PLANS.map((p) => (
            <Card key={p.plan} className="flex flex-col gap-3">
              <CardTitle className="mb-0">
                {p.name} · {p.priceLabel}
              </CardTitle>
              <p className="text-[15px] leading-[1.45] text-muted">{p.meaning}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                <li>{priceLines(p).subscription}</li>
                <li>{priceLines(p).hours}</li>
              </ul>
              {p.plan === "LAKOU" ? (
                <p className="text-sm text-muted">Gratuite. Elle s&apos;active seule avec le profil de l&apos;aîné.</p>
              ) : (
                <CallbackRequest plan={p.plan} planName={p.name} pending={requested.some((r) => r.plan === p.plan && r.aineId === null)} />
              )}
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (aines.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Formule" title="Les formules" />
        <EmptyState
          title="Ajoutez d'abord un aîné."
          action={
            <LinkButton href="/famille/aines/nouveau" size="lg" fullWidth>
              Ajouter un aîné
            </LinkButton>
          }
        >
          La formule Libre (gratuite) est activée dès la création du profil.
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
      <PageHeader
        eyebrow={`Formule ${deName(aine.firstName)}`}
        title={<>Comment veiller sur {aine.firstName}{"\u202f"}?</>}
        description="Choisissez le niveau de veille. Vous pouvez changer à tout moment."
      />
      <div className="flex flex-col gap-4">
        {launch ? (
          <Alert tone="info" title="Activation par un conseiller Koudmen">
            {NO_PAYMENT_NOTICE}
            {requested.some((r) => r.aineId === aine.id) ? <p className="mt-1 font-semibold">Votre demande est envoyée. Un conseiller vous appelle.</p> : null}
          </Alert>
        ) : (
          <Alert tone="attention" title={OFFER_TEST_NOTICE}>
            Le paiement est simulé. Aucune carte n&apos;est demandée, aucun argent n&apos;est prélevé.
          </Alert>
        )}

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

        <PlanChooser aineId={aine.id} current={aine.subscription?.plan ?? null} canChange={isPayer} launch={launch} />

        <Alert tone="info" title="Comment se calcule le prix ?">
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>Vous payez la formule à Koudmen, chaque mois.</li>
            <li>
              Vous payez les heures de visite à part, à l&apos;accompagnant. Vous le déclarez vous-même avec le <Term id="cesu" />.
            </li>
            <li>Pour ces heures, crédit d&apos;impôt de 50 % si les conditions sont remplies. L&apos;abonnement Koudmen n&apos;y ouvre pas droit.</li>
          </ul>
          <p className="mt-1 text-sm">Chaque formule montre un exemple de total par mois. Ces chiffres sont des estimations.</p>
        </Alert>

        {launch ? null : <MicroQuestion user={user} questionKey="PRIX_TROP_CHER" path="/famille/formule" />}

        {launch ? null : <Card className="flex flex-col gap-3">
          <CardTitle className="mb-0">Une vraie visite découverte ({DISCOVERY_PRICE_LABEL})</CardTitle>
          <p className="text-[15px] leading-[1.45] text-muted">Vous voulez essayer pour de vrai, avec votre parent ? Dites-le nous : nous vous recontacterons.</p>
          <LinkButton href="/famille/visite-decouverte" variant="quiet" size="lg" fullWidth>
            Réserver une vraie visite découverte
          </LinkButton>
        </Card>}

        {isPayer && !launch ? (
          <Card>
            <CardTitle>Paiements simulés</CardTitle>
            {payments.length === 0 ? (
              <p className="text-[15px] text-muted">Aucun paiement simulé pour le moment.</p>
            ) : (
              <ul className="num m-0 flex list-none flex-col p-0">
                {payments.map((p, i) => (
                  <li key={p.id} className={`flex flex-wrap justify-between gap-x-3 py-2.5 text-[15px] ${i > 0 ? "border-t border-line" : ""}`}>
                    <span className="text-muted">{formatDateTime(p.createdAt)}</span>
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
