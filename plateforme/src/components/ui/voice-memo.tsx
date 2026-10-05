"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Hauteurs de l'onde décorative (maquette). */
const WAVE = [8, 14, 22, 12, 26, 18, 10, 20, 28, 16, 9, 18, 24, 12, 20, 26, 14, 8, 16, 22, 12, 18, 10, 14, 20, 8, 12, 16];

/**
 * Mémo vocal du Kayé : pilule `surface-2`, bouton lecture encre 44 px, onde `muted`/`mer`, durée tabulaire.
 * Sans `src`, le bouton est désactivé (aria-disabled) et le dit.
 */
export function VoiceMemo({
  src,
  label,
  duration,
  progress = 0.36,
  className,
}: {
  /** URL du fichier audio. */
  src?: string;
  /** Nom accessible du bouton, ex. « Écouter le mot de Léonie, 24 secondes ». */
  label: string;
  /** Durée affichée, ex. « 0:24 ». */
  duration: string;
  /** Part de l'onde colorée (0 à 1) quand rien ne joue. */
  progress?: number;
  className?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ratio, setRatio] = useState(progress);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => a.duration && setRatio(a.currentTime / a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  };

  const on = Math.round(WAVE.length * ratio);
  return (
    <div className={cn("flex items-center gap-3 rounded-full bg-surface-2 py-2 pr-3.5 pl-2", className)}>
      <button
        type="button"
        onClick={src ? toggle : undefined}
        aria-disabled={src ? undefined : true}
        aria-label={src ? (playing ? `Mettre en pause : ${label}` : label) : `${label} (enregistrement indisponible)`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-fg text-bg aria-disabled:cursor-not-allowed"
      >
        {playing ? (
          <Pause aria-hidden="true" className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play aria-hidden="true" className="ml-0.5 size-4" fill="currentColor" strokeWidth={0} />
        )}
      </button>
      <div aria-hidden="true" className="flex h-7 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
        {WAVE.map((h, i) => (
          <i key={i} style={{ height: h }} className={cn("block w-[3px] shrink-0 rounded-[2px]", i < on ? "bg-mer" : "bg-muted opacity-55")} />
        ))}
      </div>
      <small className="num text-sm font-semibold text-muted">{duration}</small>
      {src ? <audio ref={audio} src={src} preload="none" /> : null}
    </div>
  );
}
