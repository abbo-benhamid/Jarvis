import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { ProofBadge, type ProofBadgeStatus } from "./badge";
import { GardenIllustration } from "./illustrations";

/**
 * Aperçu d'une page de Kayé (liste, accueil famille) — § 10 « Carte Kayé ».
 * Vignette 76 × 76 rayon 16, auteur + jour, badge de preuve, citation Fraunces italique 18 px, traduction `small muted`.
 * Avec `href`, toute la carte est un lien.
 */
export function KayeCard({
  author,
  day,
  proof = "preuve",
  quote,
  quoteLang,
  translation,
  thumbnail,
  href,
  headingLevel = 3,
  className,
}: {
  /** Prénom de l'accompagnante. */
  author: string;
  /** Jour de la visite, ex. « samedi ». */
  day: ReactNode;
  /** Statut de preuve affiché en badge. `null` : pas de badge. */
  proof?: ProofBadgeStatus | null;
  /** Parole de l'aîné ou phrase clé. */
  quote: ReactNode;
  /** Langue de la citation si elle n'est pas en français (ex. « gcf » pour le créole). */
  quoteLang?: string;
  /** Traduction ou complément, en `muted`. */
  translation?: ReactNode;
  /** Vignette (photo réelle avec alt, ou illustration). Par défaut : jardin au trait, décoratif. */
  thumbnail?: ReactNode;
  href?: string;
  /** Niveau du titre caché (auteur + jour) pour la navigation au clavier des lecteurs d'écran. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const body = (
    <>
      <div className="size-[76px] shrink-0 overflow-hidden rounded-md">{thumbnail ?? <GardenIllustration shape="thumb" className="h-full w-full" />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <H className="m-0 font-sans text-[15px] leading-snug font-normal tracking-normal">
            <b className="font-semibold">{author}</b> <span className="text-muted">· {day}</span>
          </H>
          {proof ? <ProofBadge status={proof} /> : null}
        </div>
        <p lang={quoteLang} className="mt-2 mb-0.5 font-display text-lg leading-[1.3] tracking-[-.005em] italic">
          {quote}
        </p>
        {translation ? <p className="m-0 text-sm leading-[1.35] text-muted">{translation}</p> : null}
      </div>
    </>
  );
  const classes = cn("flex items-start gap-3.5 rounded-card bg-surface p-4 text-fg shadow-card", className);
  return href ? (
    <Link href={href} className={cn(classes, "no-underline transition-colors duration-[120ms] hover:bg-surface-2/40")}>
      {body}
    </Link>
  ) : (
    <article className={classes}>{body}</article>
  );
}

/**
 * Détail d'une page de Kayé : photo pleine largeur rayon 20 avec badge d'humeur (verre dépoli),
 * titre h2 Fraunces, auteur, texte, puis `children` (mémo vocal, reçu de visite…).
 */
export function KayeDetail({
  photo,
  mood,
  moodIcon,
  title,
  author,
  time,
  children,
  className,
}: {
  /** Photo réelle (<img alt=…>) ou illustration. Par défaut : jardin au trait avec un texte alternatif générique. */
  photo?: ReactNode;
  /** Humeur, ex. « Humeur : joyeuse ». */
  mood?: ReactNode;
  moodIcon?: ReactNode;
  title: ReactNode;
  author: string;
  /** Heures de la visite, ex. « 10 h 04 – 12 h 01 ». */
  time?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("text-fg", className)}>
      <div className="relative mt-1">
        <div className="overflow-hidden rounded-media">{photo ?? <GardenIllustration shape="tall" label="Illustration : un jardin créole avec des giraumons" />}</div>
        {mood ? (
          <span className="absolute top-3 left-3 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] py-0.5 pr-2.5 pl-2 text-sm font-semibold text-fg backdrop-blur-[8px] [&_svg]:size-4 [&_svg]:text-soleil-ink">
            {moodIcon ? <span aria-hidden="true" className="contents">{moodIcon}</span> : null}
            {mood}
          </span>
        ) : null}
      </div>
      <h2 className="mt-5 mb-2 font-display text-[28px] leading-[1.12] font-normal tracking-[-.02em]">{title}</h2>
      <p className="mb-3 flex items-center gap-2.5 text-[15px]">
        <Avatar name={author} size={32} role="accompagnant" />
        <span>
          <b className="font-semibold">{author}</b>
          {time ? <span className="text-muted"> · {time}</span> : null}
        </span>
      </p>
      {children}
    </article>
  );
}
