import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ProofStepState = "done" | "current" | "todo";

export type ProofStep = {
  label: ReactNode;
  detail?: ReactNode;
  state: ProofStepState;
  /** Icône 16 px de l'étape (ex. ScanLine, Phone). Une étape faite montre toujours une coche. */
  icon?: ReactNode;
  /** Élément à droite : « OK », un badge « À faire »… */
  aside?: ReactNode;
};

const STATE_TEXT: Record<ProofStepState, string> = { done: "Fait :", current: "En cours :", todo: "À venir :" };

/**
 * Preuve de visite pas à pas (côté accompagnante, maquette écran d).
 * Pastille 32 px : faite (feuille pleine + coche), en cours (anneau mer), à venir (anneau line-strong).
 */
export function ProofSteps({ steps, className }: { steps: ProofStep[]; className?: string }) {
  return (
    <ol className={cn("m-0 list-none p-0", className)}>
      {steps.map((s, i) => (
        <li
          key={i}
          aria-current={s.state === "current" ? "step" : undefined}
          className={cn("flex min-h-14 items-center gap-3.5 py-1.5", i > 0 && "border-t border-line")}
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4",
              s.state === "done" && "bg-feuille text-surface",
              s.state === "current" && "text-mer shadow-[inset_0_0_0_2px_var(--mer)]",
              s.state === "todo" && "text-muted shadow-[inset_0_0_0_1.5px_var(--line-strong)]",
            )}
          >
            <span aria-hidden="true" className="contents">
              {s.state === "done" ? <Check strokeWidth={1.8} /> : s.icon}
            </span>
          </span>
          <span className="min-w-0 flex-1 text-base leading-snug">
            <span className="sr-only">{STATE_TEXT[s.state]} </span>
            {s.label}
            {s.detail ? <small className="block text-sm text-muted">{s.detail}</small> : null}
          </span>
          {s.aside ? <span className="shrink-0 text-[15px]">{s.aside}</span> : null}
        </li>
      ))}
    </ol>
  );
}
