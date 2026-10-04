import { CircleCheck, CircleDashed, CircleX, KeyRound, MapPin, PhoneCall } from "lucide-react";
import type { ProofFactor } from "@prisma/client";
import { cn } from "@/lib/cn";
import { PROOF_FACTOR_LABELS } from "@/lib/labels";
import { factorViews, type FactorView } from "@/server/famille/logic";

const FACTOR_ICONS: Record<ProofFactor, typeof MapPin> = {
  GPS: MapPin,
  CODE_DOMICILE: KeyRound,
  CONFIRMATION_AINE: PhoneCall,
};

const STATE_TEXT: Record<FactorView["state"], string> = {
  VALIDE: "validé",
  NON_VALIDE: "non validé",
  ABSENT: "pas encore",
};

/** Les 3 facteurs de la preuve de visite, avec icône ET texte (jamais la couleur seule). */
export function ProofFactors({ proofs }: { proofs: { factor: ProofFactor; valid: boolean; simulated?: boolean }[] }) {
  const views = factorViews(proofs);
  const score = views.filter((v) => v.state === "VALIDE").length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">
        Preuve de visite : {score} sur 3 {score >= 2 ? "(suffisant)" : "(il en faut 2)"}
      </p>
      <ul className="flex flex-wrap gap-2">
        {views.map((v) => {
          const Icon = FACTOR_ICONS[v.factor];
          const StateIcon = v.state === "VALIDE" ? CircleCheck : v.state === "NON_VALIDE" ? CircleX : CircleDashed;
          return (
            <li
              key={v.factor}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                v.state === "VALIDE" && "border-feuille bg-feuille-soft",
                v.state === "NON_VALIDE" && "border-line bg-bg",
                v.state === "ABSENT" && "border-dashed border-line bg-surface text-muted",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span>
                {PROOF_FACTOR_LABELS[v.factor]} : <strong>{STATE_TEXT[v.state]}</strong>
                {v.simulated ? " (simulé)" : ""}
              </span>
              <StateIcon aria-hidden="true" className={cn("size-4", v.state === "VALIDE" ? "text-feuille" : "text-muted")} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
