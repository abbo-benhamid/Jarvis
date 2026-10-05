"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Barre compacte du panneau de test : `status` (progression) et `actions` sur une ligne,
 * bouton « Détails » (aria-expanded) qui déplie `details` sous la barre.
 * `between` s'affiche entre la barre et les détails (invite de fin de scénario).
 */
export function PanelDisclosure({ status, actions, between, details }: { status: ReactNode; actions: ReactNode; between?: ReactNode; details: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {status}
        <div className="contents">
          {actions}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-11 items-center gap-1 rounded-icon px-2 text-[15px] font-semibold text-mer hover:bg-mer-soft"
          >
            Détails<span className="sr-only"> : les 3 scénarios et mon lien de reprise</span>
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} strokeWidth={1.8} />
          </button>
        </div>
      </div>
      {between}
      <div id={id} hidden={!open} className="pb-2">
        {details}
      </div>
    </>
  );
}
