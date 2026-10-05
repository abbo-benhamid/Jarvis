import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Grande option cliquable (radio ou case) pour mobile : toute la carte est la cible (≥ 56 px).
 * Style « choix de formule » (§ 10) : bord 1,5 px `line-strong`, bord 2 px `mer` + fond `mer-soft` quand choisie.
 * L'état choisi se voit par le bord, le fond ET la case cochée (pas par la couleur seule).
 */
export function ChoiceCard({
  label,
  hint,
  icon,
  className,
  id,
  type = "radio",
  compact = false,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  type?: "radio" | "checkbox";
  /** Pilule compacte (44 px), pour les longues listes (communes). */
  compact?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer bg-surface text-fg shadow-[inset_0_0_0_1.5px_var(--line-strong)] transition-colors duration-[120ms]",
        "has-[:checked]:bg-mer-soft has-[:checked]:shadow-[inset_0_0_0_2px_var(--mer)]",
        "has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid",
        compact ? "min-h-11 items-center gap-2 rounded-full py-1.5 pr-4 pl-3 text-[15px]" : "min-h-14 items-start gap-3 rounded-md px-4 py-3.5",
        className,
      )}
    >
      <input id={id} type={type} className={cn("shrink-0 accent-[var(--mer)]", compact ? "size-[18px]" : "mt-0.5 size-5")} {...props} />
      {icon ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-mer">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 text-sm leading-snug text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
