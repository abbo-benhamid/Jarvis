import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Pied d'action collant (§ 2.5, § 10) : l'action principale est en bas, au pouce, pleine largeur.
 * Dégradé vers `bg` sur 32 px au-dessus du bouton. Remplace la barre basse côté accompagnante.
 * Réservez 120 px sous le contenu (<BottomSpacer />) quand il est fixé.
 */
export function ActionDock({
  children,
  meta,
  hint,
  position = "fixed",
  label,
  className,
}: {
  /** Le bouton principal (Button fullWidth size="lg" ou "xl"). */
  children: ReactNode;
  /** Ligne au-dessus du bouton : à gauche et à droite (ex. « Dès 39 € par mois » · « Offre en test »). */
  meta?: { start: ReactNode; end?: ReactNode };
  /** Phrase d'aide sous le bouton, centrée, 14 px `muted`. */
  hint?: ReactNode;
  /** fixed (application) ou static (démo dans une page). */
  position?: "fixed" | "static";
  /** Nom accessible de la zone, ex. « Action principale ». */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      className={cn(
        "z-30 bg-[linear-gradient(to_bottom,transparent,var(--bg)_32px)] px-5 pt-8 pb-[max(20px,env(safe-area-inset-bottom))]",
        position === "fixed" ? "fixed inset-x-0 bottom-0" : "relative",
        className,
      )}
    >
      <div className="mx-auto max-w-[var(--app-column)]">
        {meta ? (
          <div className="mx-1 mb-3 flex items-baseline justify-between gap-3 text-[15px] text-muted [&_strong]:text-[17px] [&_strong]:text-fg">
            <span>{meta.start}</span>
            {meta.end ? <span>{meta.end}</span> : null}
          </div>
        ) : null}
        {children}
        {hint ? <p className="mt-2.5 text-center text-sm text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
