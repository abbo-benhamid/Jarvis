"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { Play } from "lucide-react";
import { simulateAction } from "@/server/sandbox/actions";
import type { ActionResult } from "@/lib/action-result";
import type { SimulationResult } from "@/server/sandbox/robots";
import { Button } from "@/components/ui/button";

const initial: ActionResult<SimulationResult> = { ok: false, error: "" };

/**
 * « Simuler la suite » (D14) : un clic = une étape jouée par les robots.
 * m4 : le message reste seulement sur la page où le testeur a cliqué (pas de message périmé ailleurs).
 */
export function SimulateButton() {
  const [state, dispatch, pending] = useActionState(simulateAction, initial);
  const pathname = usePathname();
  const [clickedOn, setClickedOn] = useState<string | null>(null);
  const fresh = clickedOn === pathname;
  const result = state.ok && fresh ? state.data : undefined;
  return (
    <>
      <form
        action={() => {
          setClickedOn(pathname);
          dispatch();
        }}
      >
        <Button type="submit" disabled={pending} aria-busy={pending}>
          <Play aria-hidden="true" className="size-4" />
          {pending ? "Les robots jouent…" : "Simuler la suite"}
        </Button>
      </form>
      <div role="status" aria-live="polite" className="order-last w-full">
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
        ) : !state.ok && state.error && fresh ? (
          <p className="text-sm font-semibold text-hibiscus">{state.error}</p>
        ) : null}
      </div>
    </>
  );
}
