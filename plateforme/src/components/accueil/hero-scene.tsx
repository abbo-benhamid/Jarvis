"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SunriseIllustration } from "@/components/ui/illustrations";
import { useInView, usePausePreference, useReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

/** Kayé qui défilent sur l'illustration (un toutes les ~8 s). */
export const HERO_KAYES = [
  { from: "Kayé de Léonie · samedi", text: "Elle a bien mangé. Elle a ri en parlant du marché." },
  { from: "Kayé de Léonie · mardi", text: "Café sur la galerie. Elle a arrosé ses hibiscus." },
  { from: "Kayé de Léonie · jeudi", text: "Elle a appelé sa sœur. Elle demande des nouvelles des enfants." },
] as const;

/** Temps du cycle (ms). Entrée : la carte glisse ; frappe : le texte s'écrit ; lecture ; sortie. */
const FIRST_ENTER = 2100;
const ENTER = 650;
const CHAR = 34;
const HOLD = 4200;
const LEAVE = 380;

type Phase = "enter" | "type" | "hold" | "leave";

/**
 * Héros de l'accueil : lever de soleil animé + carte Kayé « notification ».
 * - La carte glisse depuis le bas, le texte s'écrit, puis un autre Kayé arrive (rotation ~8 s).
 * - Hors écran ou après « Pause » : tout s'arrête (data-play="false"), la carte reste lisible en entier.
 * - « Réduire les animations » : image figée, premier Kayé en entier, pas de rotation, pas de bouton.
 * - Sans JavaScript : rendu complet (l'entrée CSS joue seule une fois).
 * Lecteurs d'écran : l'illustration a son texte ; la carte animée est masquée et doublée d'une phrase stable.
 */
export function HeroScene({ label }: { label: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref);
  const [paused, setPaused] = usePausePreference();
  const playing = !reduce && !paused && inView;

  const [i, setI] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>("enter");
  const [typed, setTyped] = useState(0);
  const current = HERO_KAYES[i] ?? HERO_KAYES[0];
  const text = current.text;

  // Avant l'hydratation, pas de data-play : l'entrée CSS démarre seule, sans attendre le JavaScript.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Machine à états du ticker. Elle avance seulement quand la scène joue.
  useEffect(() => {
    if (!playing) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "enter") {
      t = setTimeout(
        () => {
          setTyped(0);
          setPhase("type");
        },
        cycle === 0 ? FIRST_ENTER : ENTER,
      );
    } else if (phase === "type") {
      t = setTimeout(
        () => {
          if (typed >= text.length) setPhase("hold");
          else setTyped((n) => n + 1);
        },
        typed === 0 ? 120 : CHAR,
      );
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("leave"), HOLD);
    } else {
      t = setTimeout(() => {
        setI((n) => (n + 1) % HERO_KAYES.length);
        setCycle((c) => c + 1);
        setTyped(0);
        setPhase("enter");
      }, LEAVE);
    }
    return () => clearTimeout(t);
  }, [playing, phase, typed, text.length, cycle]);

  // Figé (réduit, pause, hors écran, avant hydratation) : texte complet, jamais à moitié écrit.
  const visibleText = reduce || !playing ? text : phase === "enter" ? "" : phase === "type" ? text.slice(0, typed) : text;
  const typing = playing && phase === "type" && typed < text.length;

  return (
    <figure
      ref={ref}
      data-play={mounted ? (playing ? "true" : "false") : undefined}
      className="kd-scene relative m-0 overflow-hidden rounded-media shadow-card lg:rounded-hero"
    >
      <SunriseIllustration label={label} />
      <figcaption className="absolute inset-x-3.5 bottom-3.5 lg:inset-x-5 lg:bottom-5">
        <span className="sr-only">Exemple de Kayé : {HERO_KAYES[0].text}</span>
        <div
          key={cycle}
          aria-hidden="true"
          data-testid="hero-kaye"
          data-leaving={phase === "leave" && playing ? "true" : undefined}
          style={{ ["--kd-notif-delay" as string]: cycle === 0 ? "1.4s" : "0s" }}
          className="kd-notif flex items-center gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-3.5 py-3 shadow-[0_8px_24px_-10px_rgb(0_0_0/.25)] backdrop-blur-[12px]"
        >
          <Avatar name="Léonie" role="aine" size={36} />
          <span className="min-w-0 flex-1 text-[14.5px] leading-[1.35]">
            <b className="mb-0.5 block text-[13px] font-semibold text-muted">{current.from}</b>
            {/* Toutes les phrases empilées et invisibles : la hauteur de la carte ne saute pas. */}
            <span className="grid">
              {HERO_KAYES.map((k) => (
                <span key={k.text} className="invisible col-start-1 row-start-1">
                  {k.text}
                </span>
              ))}
              <span className="col-start-1 row-start-1">
                {visibleText}
                {typing ? <span className="kd-caret ml-px inline-block h-[1.05em] w-[1.5px] translate-y-[2px] bg-fg" /> : null}
              </span>
            </span>
          </span>
        </div>
      </figcaption>
      {!reduce ? (
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
          data-testid="hero-pause"
          className={cn(
            "absolute top-3 right-3 grid size-11 place-items-center rounded-full text-fg",
            "bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] backdrop-blur-[8px]",
            "transition-[background-color,transform] duration-[120ms] hover:bg-surface motion-safe:active:scale-95 [&_svg]:size-[18px]",
            paused && "bg-surface",
          )}
        >
          {paused ? <Play aria-hidden="true" strokeWidth={1.8} /> : <Pause aria-hidden="true" strokeWidth={1.8} />}
          <span className="sr-only">Mettre l&apos;animation en pause</span>
        </button>
      ) : null}
    </figure>
  );
}
