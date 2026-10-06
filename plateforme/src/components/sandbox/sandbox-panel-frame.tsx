"use client";

import { useId, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Écrans de TRAVAIL (fiche visite, Kayé de l'accompagnant) : le panneau du test se réduit à une pastille
 * (UX V1 M2, arbitrage X8). Le travail reste dans le premier écran.
 */
export function isWorkScreen(pathname: string | null): boolean {
  return /^\/accompagnant\/visites\/[^/]+(\/kaye)?\/?$/.test(pathname ?? "");
}

/**
 * Cadre du panneau « Votre test ».
 * - Écran normal : le panneau complet (`children`).
 * - Écran de travail : une pastille « Mode test · 6/9 » (bouton aria-expanded) qui déplie le panneau.
 * Une seule mention « Mode test » par écran : dans la pastille, le libellé du panneau est masqué
 * (classe `group-data-[compact=true]:hidden` côté panneau).
 */
export function SandboxPanelFrame({ progress, children }: { progress: string; children: ReactNode }) {
  const pathname = usePathname();
  const compact = isWorkScreen(pathname);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!compact) return <div className="group">{children}</div>;
  return (
    <div className="group mb-3" data-compact="true">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mer-soft px-3.5 text-[15px] font-semibold text-mer"
      >
        <FlaskConical aria-hidden="true" className="size-4" strokeWidth={1.8} />
        Démo · <span className="num">{progress}</span>
        <span className="sr-only"> : afficher le panneau de la démo</span>
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} strokeWidth={1.8} />
      </button>
      <div id={id} hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
  );
}
