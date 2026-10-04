import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const FIELD =
  "block w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-muted " +
  "aria-[invalid=true]:border-hibiscus";

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
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--mer)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Bouton radio avec libellé cliquable (cible ≥ 44 px). */
export function Radio({ label, className, id, ...props }: ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", className)}>
      <input id={id} type="radio" className="mt-1 size-5 shrink-0 accent-[var(--mer)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
