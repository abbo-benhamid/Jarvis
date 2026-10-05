import type { PlanInfo } from "@/lib/plans";
import { formatEuros } from "@/lib/format";
import { formatEurosRounded, TAX_CREDIT_RATE } from "@/lib/estimates";

/**
 * A3 : exemple de coût mensuel total d'une formule.
 * Abonnement + heures d'accompagnement − crédit d'impôt (sur les heures seulement).
 */
export function PlanCostExample({ plan }: { plan: PlanInfo }) {
  const c = plan.example.cost;
  const rate = Math.round(TAX_CREDIT_RATE * 100);
  return (
    <div className="rounded-xl bg-bg p-3 text-sm">
      <p className="font-semibold">Exemple : {plan.example.label.toLowerCase()}</p>
      <dl className="mt-1 flex flex-col gap-0.5">
        <div className="flex justify-between gap-2">
          <dt>Formule {plan.name}</dt>
          <dd>{formatEuros(c.subscriptionCents)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>
            {c.hours} h d&apos;accompagnement × {formatEurosRounded(c.hourlyCostCents)}
            <span className="block text-muted">salaire et cotisations</span>
          </dt>
          <dd>{formatEuros(c.hoursCostCents)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Crédit d&apos;impôt de {rate} % sur les heures</dt>
          <dd>− {formatEuros(c.taxCreditCents)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-2 border-t border-line pt-1 text-base font-bold">
          <dt>Total par mois</dt>
          <dd>environ {formatEurosRounded(c.totalCents)}</dd>
        </div>
      </dl>
    </div>
  );
}
