import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Barre du haut d'un écran de détail (maquette, écrans c et e) : retour 44 × 44 à gauche, titre centré 17 px.
 * Le titre est le h1 de la page. `backLabel` dit où mène le retour (lecteurs d'écran).
 */
export function TopBar({ title, backHref, backLabel, end }: { title: ReactNode; backHref: string; backLabel: string; end?: ReactNode }) {
  return (
    <div className="mb-2 grid min-h-14 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <Link
        href={backHref}
        aria-label={backLabel}
        title={backLabel}
        className="-ml-2.5 inline-grid size-11 place-items-center rounded-icon text-fg transition-colors duration-[120ms] hover:bg-surface-2"
      >
        <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.6} />
      </Link>
      <h1 className="text-center font-sans text-[17px] leading-snug font-semibold tracking-normal text-balance">{title}</h1>
      <span className="-mr-2.5 justify-self-end">{end}</span>
    </div>
  );
}
