import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CaseIllustration } from "./illustrations";

/**
 * État vide (§ 10) : illustration au trait 120 px, titre Fraunces 22 px, une phrase `muted`, un bouton.
 * Ton rassurant, jamais culpabilisant.
 */
export function EmptyState({
  title,
  children,
  action,
  illustration,
  titleAs = "p",
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Illustration personnalisée ; `false` pour n'en mettre aucune. Par défaut : case créole et soleil. */
  illustration?: ReactNode | false;
  /** Balise du titre (p par défaut, pour ne pas casser la hiérarchie de la page). */
  titleAs?: "p" | "h2" | "h3";
  className?: string;
}) {
  const T = titleAs;
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center text-fg shadow-card", className)}>
      {illustration === false ? null : (illustration ?? <CaseIllustration />)}
      <T className="m-0 font-display text-[22px] leading-[1.2] font-normal tracking-[-.015em] text-balance">{title}</T>
      {children ? <div className="max-w-prose text-[15px] leading-[1.45] text-muted">{children}</div> : null}
      {action ? <div className="mt-2 flex w-full max-w-sm flex-col items-stretch gap-2">{action}</div> : null}
    </div>
  );
}
