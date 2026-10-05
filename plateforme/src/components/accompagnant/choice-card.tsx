import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Grande option cliquable (radio ou case) pour mobile : toute la carte est la cible (≥ 56 px).
 * L'état choisi se voit par la bordure, le fond ET la case cochée (pas par la couleur seule).
 */
export function ChoiceCard({
  label,
  hint,
  icon,
  className,
  id,
  type = "radio",
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  type?: "radio" | "checkbox";
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-line-strong bg-surface p-3",
        "has-[:checked]:border-mer has-[:checked]:bg-mer-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
        className,
      )}
    >
      <input id={id} type={type} className="mt-1 size-5 shrink-0 accent-[var(--mer)]" {...props} />
      {icon ? <span aria-hidden="true" className="mt-0.5 shrink-0 text-mer">{icon}</span> : null}
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
