import { Check, Minus } from "lucide-react";
import type { ProofFactor } from "@prisma/client";
import { cn } from "@/lib/cn";
import { PROOF_FACTOR_LABELS, PROOF_STATE_LABELS, proofCountLabel } from "@/lib/labels";
import { factorViews, type FactorView } from "@/server/famille/logic";

/** X4 : état d'une preuve. Une preuve absente est « À faire » pendant la visite, « Non obtenue » après. */
export function proofStateLabel(state: FactorView["state"], finished: boolean): string {
  if (state === "VALIDE") return PROOF_STATE_LABELS.OBTENUE;
  if (state === "ABSENT" && !finished) return PROOF_STATE_LABELS.A_FAIRE;
  return PROOF_STATE_LABELS.NON_OBTENUE;
}

/**
 * Les 3 preuves d'une visite, version compacte du reçu : pastille (coche ou tiret) ET texte.
 * Jamais la couleur seule. Compteur unique (X4) : « 2 preuves sur 3 ». Il en faut 2.
 */
export function ProofFactors({
  proofs,
  finished = true,
}: {
  proofs: { factor: ProofFactor; valid: boolean; simulated?: boolean }[];
  /** La visite est finie (une preuve absente n'arrivera plus). */
  finished?: boolean;
}) {
  const views = factorViews(proofs);
  const score = views.filter((v) => v.state === "VALIDE").length;
  return (
    <div className="flex flex-col">
      <p className="text-[15px] font-semibold">
        <span className="num">{proofCountLabel(score)}</span> {score >= 2 ? "· suffisant" : "· il en faut 2"}
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
                {PROOF_FACTOR_LABELS[v.factor]} : <strong className="font-semibold">{proofStateLabel(v.state, finished)}</strong>
                {v.simulated ? <span className="text-muted"> (simulé)</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
