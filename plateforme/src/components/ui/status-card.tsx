import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { Kreyol } from "./card";

/** État de l'aîné : bien (feuille), surveiller (soleil-ink), alerte (hibiscus). Le mot porte le sens, la couleur le renforce. */
export type StatusTone = "bien" | "surveiller" | "alerte";

const WORD: Record<StatusTone, string> = { bien: "text-feuille", surveiller: "text-soleil-ink", alerte: "text-hibiscus" };
const DOT: Record<StatusTone, string> = {
  bien: "bg-feuille [--kd-dot-halo:var(--feuille-soft)]",
  surveiller: "bg-soleil [--kd-dot-halo:var(--soleil-soft)]",
  alerte: "bg-hibiscus [--kd-dot-halo:var(--hibiscus-soft)]",
};
const DOT_RING: Record<StatusTone, string> = {
  bien: "shadow-[0_0_0_4px_var(--feuille-soft)]",
  surveiller: "shadow-[0_0_0_4px_var(--soleil-soft)]",
  alerte: "shadow-[0_0_0_4px_var(--hibiscus-soft)]",
};

export type StatusStat = { value: ReactNode; label: ReactNode };

/**
 * Carte d'état « Elle va bien. » (§ 10) : la réponse en grand, en serif, un seul mot en italique couleur.
 * Rayon 28 px, avatar 56 px à anneau madras, ligne créole, puis 3 chiffres séparés par des filets.
 */
export function StatusCard({
  name,
  detail,
  lead,
  word,
  tone = "bien",
  kreyol,
  note,
  stats,
  label,
  headingLevel = 2,
  className,
}: {
  /** Ligne du haut, ex. « Léonie, votre maman ». */
  name: string;
  /** Sous-ligne, ex. « 84 ans · Sainte-Luce ». */
  detail?: ReactNode;
  /** Début de la phrase d'état, ex. « Elle va ». */
  lead: ReactNode;
  /** Mot d'état en italique couleur, ex. « bien. ». */
  word: string;
  tone?: StatusTone;
  /** Mot créole (Fraunces italique soleil-ink), ex. « Sa ka maché ». */
  kreyol?: string;
  /** Suite de la ligne, ex. « visite samedi, 12 h 01 ». */
  note?: ReactNode;
  /** Jusqu'à 3 chiffres (tabulaires). */
  stats?: StatusStat[];
  /** Nom accessible de la section, ex. « État de Léonie ». */
  label?: string;
  /** Niveau du titre d'état (2 par défaut : le h1 de la page est la salutation). */
  headingLevel?: 1 | 2 | 3;
  className?: string;
}) {
  const H = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <section aria-label={label} className={cn("relative overflow-hidden rounded-hero bg-surface px-[22px] py-5 text-fg shadow-card", className)}>
      <div className="flex items-center gap-4">
        <Avatar name={name} size={56} role="aine" />
        <div className="min-w-0">
          <b className="block text-[17px] leading-snug font-semibold">{name}</b>
          {detail ? <span className="text-[15px] text-muted">{detail}</span> : null}
        </div>
      </div>
      <H className="mt-[18px] mb-1.5 font-display text-[36px] leading-[1.05] font-normal tracking-[-.02em]">
        {lead} <em className={cn("italic", WORD[tone])}>{word}</em>
      </H>
      {kreyol || note ? (
        <p className="flex items-center gap-2.5 text-[15px] text-muted">
          <span aria-hidden="true" className={cn("kd-breathe size-2 shrink-0 rounded-full", DOT[tone], DOT_RING[tone])} />
          <span>
            {kreyol ? <Kreyol>{kreyol}</Kreyol> : null}
            {kreyol && note ? " · " : null}
            {note}
          </span>
        </p>
      ) : null}
      {stats && stats.length > 0 ? (
        <dl className="mt-5 grid grid-cols-3 border-t border-line pt-4">
          {stats.slice(0, 3).map((s, i) => (
            <div key={i} className={cn("flex min-w-0 flex-col-reverse", i > 0 && "border-l border-line pl-3.5")}>
              <dt className="mt-1 text-[13.5px] leading-[1.3] text-muted">{s.label}</dt>
              <dd className="num m-0 text-2xl leading-[1.1] font-semibold tracking-[-.01em]">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
