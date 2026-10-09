"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/cn";

export type TourScreen = {
  id: string;
  /** Sur-titre, ex. « Exemple · Le Kayé ». */
  eyebrow: string;
  title: string;
  text: ReactNode;
  body?: ReactNode;
};

/**
 * P1 : visite guidée en quelques écrans (famille : « Découvrir Koudmen » ; accompagnant : « Découvrir le métier »).
 * - Un écran à la fois ; « Précédent » / « Suivant » ; barre d'avancement segmentée ; « Écran 2 sur 5 » écrit.
 * - Au changement d'écran, le focus va sur le titre (lecteurs d'écran, clavier) et la page remonte en haut de la visite.
 * - Tous les écrans sont dans le HTML (les autres sont `hidden`) : rien n'est chargé au fil de la visite, aucun appel serveur.
 * - Apparition douce (`kd-appear`), figée si la personne réduit les animations.
 */
export function GuidedTour({ screens, label, end }: { screens: TourScreen[]; label: string; end: ReactNode }) {
  const [index, setIndex] = useState(0);
  const titles = useRef<(HTMLHeadingElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const total = screens.length;
  const last = index === total - 1;

  useEffect(() => {
    if (!moved.current) return;
    titles.current[index]?.focus({ preventScroll: true });
    const top = root.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      root.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }, [index]);

  const go = (n: number) => {
    moved.current = true;
    setIndex(Math.min(total - 1, Math.max(0, n)));
  };

  return (
    <section aria-label={label} ref={root} className="scroll-mt-4" data-testid="visite-guidee">
      <div className="mb-5 flex items-center gap-3">
        <ol aria-hidden="true" className="m-0 flex flex-1 list-none gap-1.5 p-0">
          {screens.map((s, i) => (
            <li key={s.id} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none", i <= index ? "bg-mer" : "bg-surface-2")} />
          ))}
        </ol>
        <p className="num shrink-0 text-sm font-semibold text-muted" aria-live="polite" data-testid="visite-position">
          Écran {index + 1} sur {total}
        </p>
      </div>

      {screens.map((s, i) => (
        <div key={s.id} hidden={i !== index} data-ecran={s.id} className={i === index ? "kd-appear" : undefined}>
          <p className="text-[13px] leading-snug font-semibold tracking-[.12em] text-mer uppercase">{s.eyebrow}</p>
          <h2
            ref={(el) => {
              titles.current[i] = el;
            }}
            tabIndex={-1}
            className="mt-2 font-display text-[30px] leading-[1.08] font-normal tracking-[-.02em] text-balance outline-none"
          >
            {s.title}
          </h2>
          <div className="mt-2.5 text-[16.5px] leading-normal text-muted">{s.text}</div>
          {s.body ? <div className="mt-5">{s.body}</div> : null}
        </div>
      ))}

      <div className="mt-7 flex flex-col gap-3">
        {last ? end : null}
        <div className="flex items-center gap-2.5">
          {index > 0 ? (
            <Button variant="quiet" size="lg" onClick={() => go(index - 1)} icon={<ArrowLeft strokeWidth={1.8} />} className="shrink-0">
              Précédent
            </Button>
          ) : null}
          {!last ? (
            <Button variant="primary" size="lg" fullWidth onClick={() => go(index + 1)} iconEnd={<ArrowRight strokeWidth={1.8} />}>
              Suivant
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
