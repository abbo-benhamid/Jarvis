"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Interrupteur (§ 10) : 52 × 32, `mer` actif, role="switch".
 * Le nom accessible vient de `label` (aria-label) ou de `labelledBy` (texte visible à côté).
 * Avec `name`, la valeur part avec le formulaire (« on » si actif).
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  label,
  labelledBy,
  describedBy,
  name,
  disabled,
  className,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => {
          setInner(!on);
          onCheckedChange?.(!on);
        }}
        className={cn(
          // Zone tactile 44 px autour d'un rail de 52 × 32 (WCAG 2.5.8).
          "relative inline-flex h-11 w-[52px] shrink-0 cursor-pointer items-center rounded-full disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative block h-8 w-[52px] rounded-full transition-colors duration-[200ms]",
            on ? "bg-mer" : "bg-surface-2 shadow-[inset_0_0_0_1.5px_var(--line-strong)]",
          )}
        >
          <span
            className={cn(
              "absolute top-[3px] left-[3px] size-[26px] rounded-full shadow-[0_1px_2px_rgb(0_0_0/.2)] transition-transform duration-[200ms] ease-out",
              on ? "translate-x-5 bg-on-mer" : "translate-x-0 bg-surface",
            )}
          />
        </span>
      </button>
      {name ? <input type="hidden" name={name} value={on ? "on" : ""} disabled={!on} /> : null}
    </>
  );
}
