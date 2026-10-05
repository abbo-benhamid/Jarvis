"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import type { Plan } from "@prisma/client";
import { changePlanAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { PlanCostExample } from "./plan-cost";

/** F9 : les 3 formules. Seul le payeur peut choisir (sinon boutons absents). Un choix demande une confirmation. */
export function PlanChooser({ aineId, current, canChange }: { aineId: string; current: Plan | null; canChange: boolean }) {
  const [state, action, pending] = useActionState(changePlanAction, initialActionState);
  const [confirming, setConfirming] = useState<Plan | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      <ul className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const active = current === p.plan;
          return (
            <li
              key={p.plan}
              className={cn("flex flex-col gap-3 rounded-2xl border bg-surface p-5", active ? "border-2 border-mer" : "border-line")}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-2xl font-bold">{p.name}</h2>
                {active ? <Badge tone="mer">Formule actuelle</Badge> : null}
              </div>
              <p className="text-xl font-bold">{p.priceLabel}</p>
              <p className="text-muted">{p.meaning}</p>
              <ul className="flex flex-1 flex-col gap-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-feuille" />
                    {f}
                  </li>
                ))}
              </ul>
              <PlanCostExample plan={p} />
              {canChange && !active ? (
                confirming === p.plan ? (
                  <form action={action} className="flex flex-col gap-2 rounded-xl border-2 border-mer p-3">
                    <input type="hidden" name="aineId" value={aineId} />
                    <input type="hidden" name="plan" value={p.plan} />
                    <p className="font-semibold">
                      Vous choisissez {p.name}, {p.priceLabel}. Paiement simulé. Confirmer ?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={pending} aria-busy={pending}>
                        {pending ? "Activation…" : "Confirmer"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirming(null)} disabled={pending}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button variant={p.plan === "SERENITE" ? "primary" : "secondary"} className="w-full" onClick={() => setConfirming(p.plan)}>
                    Choisir {p.name}
                  </Button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
