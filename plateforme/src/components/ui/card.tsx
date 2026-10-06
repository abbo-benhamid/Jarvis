import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Padding de carte (§ 5) : 20 px standard, 16 px dense, aucun (contenu pleine largeur). */
export type CardPadding = "md" | "dense" | "none";

const PADDING: Record<CardPadding, string> = { md: "p-5", dense: "p-4", none: "p-0" };

/** Classes d'une carte coton : rayon 24 px, ombre unique, pas de bord en clair (filet blanc 4 % en sombre). */
export function cardClasses(padding: CardPadding = "md", className?: string) {
  // kd-appear : apparition douce (fondu + 8 px, 320 ms), figée en mode réduit.
  return cn("kd-appear rounded-card bg-surface text-fg shadow-card", PADDING[padding], className);
}

type CardProps = Omit<ComponentProps<"section">, "ref"> & {
  /** Élément HTML rendu. `section` par défaut (compatibilité). */
  as?: "section" | "article" | "div";
  padding?: CardPadding;
};

export function Card({ as: Tag = "section", padding = "md", className, ...props }: CardProps) {
  return <Tag className={cardClasses(padding, className)} {...props} />;
}

/** Titre de carte : Figtree 600 17 px (§ 4, jeton `title`). */
export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("mb-2 font-sans text-[17px] leading-[1.3] font-semibold tracking-normal", className)} {...props} />;
}

/**
 * Carte cliquable : toute la carte est le lien, chevron 18 px `muted` à droite.
 * Le texte du lien = le contenu de la carte (pas de « cliquez ici »).
 */
export function CardLink({
  href,
  className,
  children,
  padding = "md",
  ...props
}: Omit<ComponentProps<typeof Link>, "children"> & { children: ReactNode; padding?: CardPadding }) {
  return (
    <Link
      href={href}
      className={cardClasses(
        padding,
        cn("flex items-center gap-4 no-underline transition-colors duration-[120ms] hover:bg-surface-2/40", className),
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-muted" strokeWidth={1.6} />
    </Link>
  );
}

/** Titre de section (§ 5) : 15 px 600 `muted`, 24 px au-dessus, 10 px sous le titre. Lien optionnel à droite. */
export function SectionHeader({
  title,
  action,
  as: Tag = "h2",
  id,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-0.5 mt-6 mb-2.5 flex items-baseline justify-between gap-3", className)}>
      <Tag id={id} className="m-0 font-sans text-[15px] leading-snug font-semibold tracking-[.01em] text-muted">
        {title}
      </Tag>
      {action}
    </div>
  );
}

/** Sur-titre : 13 px, majuscules, +0,12 em, `muted`. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-[13px] leading-snug font-semibold tracking-[.12em] text-muted uppercase", className)} {...props} />;
}

/** Mot ou phrase en créole : Fraunces italique `soleil-ink`. `lang` vaut « gcf » (créole guadeloupéen/martiniquais) [À VÉRIFIER code]. */
export function Kreyol({ className, lang = "gcf", ...props }: ComponentProps<"span">) {
  return <span lang={lang} className={cn("kreyol", className)} {...props} />;
}

/** Filet madras décoratif : 2 px (séparateur) ou 3 px (haut du reçu). */
export function MadrasLine({ thick = false, className }: { thick?: boolean; className?: string }) {
  return <div aria-hidden="true" className={cn("bg-[image:var(--madras)]", thick ? "h-[3px]" : "h-[2px] rounded-[2px] opacity-90", className)} />;
}

/**
 * Pavé de date 56 × 62 (prochaine visite) : jour abrégé en hibiscus (seul usage non-alerte de l'hibiscus, § 2.3), numéro tabulaire.
 * `label` donne la date complète aux lecteurs d'écran (ex. « jeudi 8 octobre »).
 */
export function DateBox({ day, date, label, className }: { day: string; date: string | number; label: string; className?: string }) {
  return (
    <span className={cn("flex h-[62px] w-14 shrink-0 flex-col items-center justify-center rounded-md bg-surface-2", className)}>
      <span className="sr-only">{label}</span>
      <small aria-hidden="true" className="text-xs font-bold tracking-[.1em] text-hibiscus uppercase">
        {day}
      </small>
      <b aria-hidden="true" className="num text-2xl leading-none font-semibold">
        {date}
      </b>
    </span>
  );
}

/** Puce neutre 34 px (centres d'intérêt, consignes). */
export function Chip({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-flex h-[34px] items-center rounded-full bg-surface-2 px-3.5 text-[14.5px] font-medium text-fg", className)}
      {...props}
    />
  );
}
