import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Champ (§ 10) : 56 px, rayon 16, bord 1,5 px `line-strong` (≥ 3:1), focus = anneau global. Erreur : bord 2 px hibiscus. */
const FIELD =
  "block w-full min-h-14 rounded-field border-[1.5px] border-line-strong bg-surface px-4 py-3 text-[17px] leading-snug text-fg placeholder:text-muted " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-2 aria-[invalid=true]:border-hibiscus";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(FIELD, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(FIELD, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Case à cocher avec libellé cliquable (cible ≥ 44 px). */
export function Checkbox({ label, className, id, ...props }: ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-6 shrink-0 accent-[var(--mer)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Bouton radio avec libellé cliquable (cible ≥ 44 px). */
export function Radio({ label, className, id, ...props }: ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", className)}>
      <input id={id} type="radio" className="mt-0.5 size-6 shrink-0 accent-[var(--mer)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
