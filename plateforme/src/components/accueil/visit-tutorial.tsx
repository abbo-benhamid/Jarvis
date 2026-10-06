"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useInView, useReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

/** Les 3 étapes du tutoriel. Le numéro est écrit : l'ordre ne dépend pas de la couleur. */
export const TUTORIAL_STEPS = [
  { title: "L'accompagnant arrive", text: "Son arrivée s'enregistre : 14:02." },
  { title: "La visite est prouvée", text: "Position, code chez votre parent… 2 preuves sur 3 suffisent." },
  { title: "Vous recevez le Kayé", text: "Un mot, l'humeur, les activités. Sur votre téléphone." },
] as const;

/**
 * Étapes de la scène (data-stage) : 0 rien · 1 arrivée · 2 preuves une à une · 3 verdict · 4 Kayé.
 * Temps en ms depuis le début de la lecture.
 */
const TIMELINE: [stage: number, at: number][] = [
  [1, 350],
  [2, 2300],
  [3, 4700],
  [4, 6400],
];

/** Étape du texte (0, 1, 2) pour une étape de scène. */
const stepOf = (stage: number) => (stage <= 1 ? 0 : stage <= 3 ? 1 : 2);

/**
 * Tutoriel animé « Ce que vous recevez après une visite ».
 * Quand la scène entre à l'écran, elle joue une fois : l'arrivée 14:02, les preuves se cochent une à une,
 * le verdict, puis le Kayé arrive comme une notification. Les 3 textes suivent l'étape (aria-current="step").
 * « Revoir » rejoue la scène.
 * Sans JavaScript ou avec « réduire les animations » : pas de data-stage, tout est visible, figé.
 * Mobile : textes puis scène, l'un sous l'autre. Bureau : textes à gauche, scène à droite.
 */
export function VisitTutorial({ intro, receipt, kaye }: { intro: ReactNode; receipt: ReactNode; kaye: ReactNode }) {
  const scene = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Déclencheur : le haut de la scène entre dans les 55 % hauts de l'écran (elle est alors bien lisible).
  const inView = useInView(scene, { rootMargin: "0px 0px -45% 0px" });
  // Visible, même un peu. Sinon la lecture saute à la fin.
  const visible = useInView(scene);
  // null : figé (rendu serveur, mode réduit). Sinon, étape 0 à 4.
  const [stage, setStage] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const played = useRef(false);

  // À l'hydratation (animations permises) : la scène se cache, prête à jouer.
  useEffect(() => {
    if (reduce) {
      setStage(null);
      return;
    }
    if (!played.current) setStage(0);
  }, [reduce]);

  const play = useCallback(() => {
    played.current = true;
    setStage(0);
    setRun((r) => r + 1);
  }, []);

  // Première entrée à l'écran : lecture.
  useEffect(() => {
    if (!reduce && inView && !played.current) play();
  }, [inView, reduce, play]);

  // Lecture : une minuterie par étape. Hors écran, la lecture saute à la fin (rien ne reste à moitié).
  useEffect(() => {
    if (run === 0 || reduce) return;
    // Les étapes ne reculent jamais (un saut à la fin reste à la fin).
    const timers = TIMELINE.map(([s, at]) => setTimeout(() => setStage((p) => Math.max(p ?? 0, s)), at));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce]);

  useEffect(() => {
    if (!visible && played.current && !reduce) setStage(4);
  }, [visible, reduce]);

  const active = stage === null ? null : stepOf(stage);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
      <div className="flex flex-col gap-3 lg:sticky lg:top-8">
        {intro}
        <ol className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
          {TUTORIAL_STEPS.map((s, n) => {
            const isActive = active === n;
            const reached = active === null || n <= active;
            return (
              <li
                key={s.title}
                data-kd-step
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex gap-3 rounded-md px-3 py-2.5",
                  isActive ? "bg-mer-soft" : "bg-transparent",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "num grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
                    reached ? "bg-mer text-on-mer" : "bg-surface-2 text-fg",
                  )}
                >
                  {n + 1}
                </span>
                <span className="min-w-0">
                  <b className="block text-[16.5px] leading-snug font-semibold">
                    <span className="sr-only">{n + 1}. </span>
                    {s.title}
                  </b>
                  <span className="block text-[15px] leading-snug text-muted">{s.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
        {stage !== null && !reduce ? (
          <button
            type="button"
            onClick={play}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-icon px-3 text-[15px] font-semibold text-mer transition-[background-color,transform] duration-[120ms] hover:bg-mer-soft motion-safe:active:scale-[.97] [&_svg]:size-4"
          >
            <RotateCcw aria-hidden="true" strokeWidth={1.8} />
            Revoir
            <span className="sr-only"> l&apos;animation des étapes</span>
          </button>
        ) : null}
      </div>
      <div ref={scene} data-stage={stage ?? undefined} data-testid="tutoriel-scene" className="kd-tuto flex flex-col gap-4">
        {/* Mobile : l'étape en cours reste sous les yeux pendant la scène (les textes sont plus haut). */}
        {active !== null ? (
          <p
            aria-hidden="true"
            className="sticky top-3 z-10 m-0 inline-flex items-center gap-2 self-start rounded-full bg-mer-soft py-1.5 pr-4 pl-1.5 text-[15px] font-semibold text-fg shadow-card lg:hidden"
          >
            <span className="num grid size-6 place-items-center rounded-full bg-mer text-[13px] text-on-mer">{active + 1}</span>
            {TUTORIAL_STEPS[active]?.title}
          </p>
        ) : null}
        {receipt}
        <div data-kd-notif>{kaye}</div>
      </div>
    </div>
  );
}
