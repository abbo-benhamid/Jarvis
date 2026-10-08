"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import type { Plan } from "@prisma/client";
import { changePlanAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { NO_PAYMENT_NOTICE, OFFER_TEST_NOTICE, PLANS, type PlanInfo } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PlanRadio, type PlanOption } from "@/components/ui/plan-radio";
import { PlanCostExample } from "./plan-cost";
import { CallbackRequest, type CreneauOption } from "./callback-request";

/** « dès 149 € par mois » → préfixe, prix, suffixe : mêmes mots, mise en forme de la maquette (écran e). */
function splitPrice(label: string): Pick<PlanOption, "price" | "pricePrefix" | "priceSuffix"> {
  const m = label.match(/^(dès )?(.+?)( par mois)?$/);
  if (!m) return { price: label };
  return { pricePrefix: m[1]?.trim(), price: m[2] ?? label, priceSuffix: m[3]?.trim() };
}

function toOption(p: PlanInfo, current: Plan | null, locked: boolean): PlanOption {
  return {
    value: p.plan,
    name: p.name,
    ...splitPrice(p.priceLabel),
    description: p.meaning,
    features: p.features,
    tag: current === p.plan ? "Formule actuelle" : undefined,
    disabled: locked && current !== p.plan,
  };
}

/**
 * F9 (maquette, écran e) : les 3 formules en cartes radio. Seul le payeur choisit (sinon lecture seule).
 * Un choix demande une confirmation (erreur de doigt sur mobile). Paiement simulé.
 */
export function PlanChooser({
  aineId,
  current,
  canChange,
  launch = false,
  callback: cb,
}: {
  aineId: string;
  current: Plan | null;
  canChange: boolean;
  launch?: boolean;
  /** L1d (M4) : numéro, créneaux et demandes ouvertes pour le formulaire « Demander un appel ». */
  callback?: { phone: string | null; creneaux: CreneauOption[]; pendingSince: Record<"KOZE" | "SERENITE", string | null> };
}) {
  // L4 / R8 : en lancement, une formule payante = demande de rappel par un conseiller (aucun paiement).
  const callback = (p: PlanInfo) => launch && p.priceCents > 0;
  const [state, action, pending] = useActionState(changePlanAction, initialActionState);
  const [selected, setSelected] = useState<Plan>(current ?? "LAKOU");
  const [confirming, setConfirming] = useState(false);
  const plan = PLANS.find((p) => p.plan === selected) ?? PLANS[0]!;
  const isCurrent = selected === current;

  const showCallback = canChange && !isCurrent && callback(plan) && cb && (plan.plan === "KOZE" || plan.plan === "SERENITE");
  return (
    <>
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="aineId" value={aineId} />
      <PlanRadio
        name="plan"
        legend="Formules"
        legendHidden
        options={PLANS.map((p) => toOption(p, current, !canChange))}
        value={selected}
        onValueChange={(v) => {
          setSelected(v as Plan);
          setConfirming(false);
        }}
        notice={OFFER_TEST_NOTICE}
      />

      <Card padding="dense">
        <PlanCostExample plan={plan} />
      </Card>

      <FormMessage state={state} />

      {canChange && !showCallback ? (
        isCurrent ? (
          <p className="rounded-md bg-surface-2 p-3.5 text-center text-[15px] font-semibold">La formule {plan.name} est votre formule actuelle.</p>
        ) : confirming ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
            <p className="text-[17px] font-semibold">
              {callback(plan) ? (
                <>Un conseiller Koudmen vous appelle pour la formule {plan.name}. {NO_PAYMENT_NOTICE}</>
              ) : launch ? (
                <>Vous choisissez {plan.name}, gratuite. Confirmer{"\u202f"}?</>
              ) : (
                <>Vous choisissez {plan.name}, {plan.priceLabel}. Paiement simulé. Confirmer{"\u202f"}?</>
              )}
            </p>
            <Button type="submit" size="lg" fullWidth disabled={pending} aria-busy={pending} icon={<Lock strokeWidth={1.6} />}>
              {pending ? "Envoi…" : callback(plan) ? "Être appelé" : "Confirmer"}
            </Button>
            <Button variant="link" fullWidth onClick={() => setConfirming(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button size="lg" fullWidth onClick={() => setConfirming(true)}>
            {callback(plan) ? `Être appelé pour ${plan.name}` : `Choisir ${plan.name}`}
          </Button>
        )
      ) : null}
    </form>
    {showCallback ? (
      <CallbackRequest
        key={plan.plan}
        plan={plan.plan as "KOZE" | "SERENITE"}
        label={`Demander un appel pour la formule ${plan.name}`}
        aineId={aineId}
        defaultPhone={cb.phone}
        creneaux={cb.creneaux}
        pendingSince={cb.pendingSince[plan.plan as "KOZE" | "SERENITE"]}
      />
    ) : null}
    </>
  );
}
