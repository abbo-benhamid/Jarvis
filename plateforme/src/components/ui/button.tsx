import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bouton (direction artistique § 10).
 * - primary : mer / on-mer. Un seul par écran.
 * - ink : encre / sable. Action forte non commerciale.
 * - quiet : sable creusé / encre. Action secondaire.
 * - link : texte mer 600, zone 44 px. Navigation.
 * Variantes historiques gardées pour les écrans actuels : secondary (= quiet), ghost (= link), danger, soleil.
 */
export type ButtonVariant = "primary" | "ink" | "quiet" | "link" | "secondary" | "ghost" | "danger" | "soleil";
/** md : 44 px (compact, en ligne) · lg : 56 px (action principale) · xl : 60 px (côté accompagnante). */
export type ButtonSize = "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-mer text-on-mer hover:bg-mer-strong active:bg-mer-strong",
  ink: "bg-fg text-bg hover:opacity-90",
  quiet: "bg-surface-2 text-fg hover:bg-line",
  secondary: "bg-surface-2 text-fg hover:bg-line",
  link: "bg-transparent text-mer hover:bg-mer-soft",
  ghost: "bg-transparent text-mer hover:bg-mer-soft",
  danger: "bg-hibiscus text-on-hibiscus hover:opacity-90",
  soleil: "bg-soleil text-on-soleil hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 rounded-icon px-4 py-2 text-base",
  lg: "min-h-14 rounded-button px-6 py-3 text-[17px]",
  xl: "min-h-[60px] rounded-button px-6 py-3 text-lg",
};

const QUIET_LG = "min-h-[52px] rounded-button px-6 py-3 text-[17px]";

/** Classes d'un bouton. Cible tactile ≥ 44 px (WCAG 2.5.8). `fullWidth` : pleine largeur (mobile, pied d'action). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string, fullWidth = false) {
  const isLink = variant === "link" || variant === "ghost";
  return cn(
    "inline-flex items-center justify-center gap-2.5 font-semibold tracking-[.005em] no-underline",
    "transition-[background-color,opacity] duration-[120ms] ease-out select-none",
    "disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
    "[&_svg]:size-[18px] [&_svg]:shrink-0",
    // Le lien reste compact (zone 44 px). Le bouton discret fait 52 px (§ 10). Une seule classe de taille : pas de conflit.
    isLink && size !== "md" ? "min-h-11 rounded-icon px-3 py-2 text-[17px]" : variant === "quiet" && size === "lg" ? QUIET_LG : SIZES[size],
    fullWidth && "w-full",
    VARIANTS[variant],
    className,
  );
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Pleine largeur (bouton principal mobile). */
  fullWidth?: boolean;
  /** Icône à gauche (18 px, décorative). */
  icon?: ReactNode;
  /** Icône à droite, par exemple une flèche (18 px, décorative). */
  iconEnd?: ReactNode;
};

type ButtonProps = ComponentProps<"button"> & Common;

export function Button({ variant, size, fullWidth, icon, iconEnd, className, type = "button", children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className, fullWidth)} {...props}>
      {icon ? <span aria-hidden="true" className="contents">{icon}</span> : null}
      {children}
      {iconEnd ? <span aria-hidden="true" className="contents">{iconEnd}</span> : null}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & Common;

export function LinkButton({ variant, size, fullWidth, icon, iconEnd, className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className, fullWidth)} {...props}>
      {icon ? <span aria-hidden="true" className="contents">{icon}</span> : null}
      {children}
      {iconEnd ? <span aria-hidden="true" className="contents">{iconEnd}</span> : null}
    </Link>
  );
}

/** Bouton icône 44 × 44, rayon 14 px. `label` est obligatoire (lecteurs d'écran). */
export function IconButton({
  label,
  filled = false,
  className,
  type = "button",
  children,
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string; filled?: boolean }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-11 shrink-0 place-items-center rounded-icon text-fg transition-colors duration-[120ms]",
        "[&_svg]:size-6 [&_svg]:shrink-0",
        filled ? "bg-surface shadow-card hover:bg-surface-2" : "bg-transparent hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="contents">
        {children}
      </span>
    </button>
  );
}
