import { Check, Minus } from "lucide-react";
import type { ProofFactor } from "@prisma/client";
import { cn } from "@/lib/cn";
import { PROOF_FACTOR_LABELS } from "@/lib/labels";
import { factorViews, type FactorView } from "@/server/famille/logic";

const STATE_TEXT: Record<FactorView["state"], string> = {
  VALIDE: "validé",
  NON_VALIDE: "non validé",
  ABSENT: "pas encore",
};

/**
 * Les 3 preuves d'une visite, version compacte du reçu : pastille (coche ou tiret) ET texte.
 * Jamais la couleur seule. « 2 sur 3 » suffit.
 */
export function ProofFactors({ proofs }: { proofs: { factor: ProofFactor; valid: boolean; simulated?: boolean }[] }) {
  const views = factorViews(proofs);
  const score = views.filter((v) => v.state === "VALIDE").length;
  return (
    <div className="flex flex-col">
      <p className="text-[15px] font-semibold">
        Preuve de visite : <span className="num">{score} sur 3</span> {score >= 2 ? "(suffisant)" : "(il en faut 2)"}
      </p>
      <ul className="m-0 mt-1 list-none p-0">
        {views.map((v, i) => {
          const ok = v.state === "VALIDE";
          return (
            <li key={v.factor} className={cn("flex min-h-11 items-center gap-3 py-1 text-[15px]", i > 0 && "border-t border-line")}>
              <span
                aria-hidden="true"
                className={cn("grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5", ok ? "bg-feuille-soft text-feuille" : "bg-surface-2 text-muted")}
              >
                {ok ? <Check strokeWidth={2} /> : <Minus strokeWidth={2} />}
              </span>
              <span className="min-w-0 flex-1">
                {PROOF_FACTOR_LABELS[v.factor]} : <strong className="font-semibold">{STATE_TEXT[v.state]}</strong>
                {v.simulated ? <span className="text-muted"> (simulé)</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
