"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * L1-A : petit formulaire d'action du back-office (champs cachés + bouton + message).
 * `confirm` : case obligatoire avant l'action (ex. « J'ai appelé la personne », J31).
 */
export function OpsAction({
  action,
  fields,
  label,
  variant = "primary",
  confirm,
  children,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  variant?: "primary" | "quiet";
  confirm?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {confirm ? (
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" value="on" required className="mt-1 size-4" />
          <span>{confirm}</span>
        </label>
      ) : null}
      <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
        {pending ? "Enregistrement…" : label}
      </Button>
      {state.ok && state.message ? (
        <p role="status" className="text-sm font-semibold text-feuille">
          {state.message}
        </p>
      ) : !state.ok && state.error ? (
        <p role="alert" className="text-sm font-semibold text-hibiscus">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
