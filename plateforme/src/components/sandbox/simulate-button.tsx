"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Play } from "lucide-react";
import { simulateAction } from "@/server/sandbox/actions";
import type { ActionResult } from "@/lib/action-result";
import type { SimulationResult } from "@/server/sandbox/robots";
import { Button } from "@/components/ui/button";

const initial: ActionResult<SimulationResult> = { ok: false, error: "" };

/** « Simuler la suite » (D14) : un clic = une étape jouée par les robots. */
export function SimulateButton() {
  const [state, dispatch, pending] = useActionState(simulateAction, initial);
  const result = state.ok ? state.data : undefined;
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <form action={dispatch}>
        <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto">
          <Play aria-hidden="true" className="size-4" />
          {pending ? "Les robots jouent…" : "Simuler la suite"}
        </Button>
      </form>
      <div role="status" aria-live="polite" className="sm:max-w-md">
        {result ? (
          <p className="rounded-lg bg-surface p-3 text-sm">
            <span className="font-semibold">{result.acted ? "Les robots ont joué. " : ""}</span>
            {result.message}{" "}
            {result.href ? (
              <Link href={result.href} className="font-semibold text-mer underline">
                {result.hrefLabel ?? "Voir"}
              </Link>
            ) : null}
          </p>
        ) : !state.ok && state.error ? (
          <p className="text-sm font-semibold text-hibiscus">{state.error}</p>
        ) : null}
      </div>
    </div>
  );
}
