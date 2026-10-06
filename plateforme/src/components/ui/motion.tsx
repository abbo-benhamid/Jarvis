"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/*
 * Outils de mouvement (sprint V2-web). Pas de bibliothèque : matchMedia + IntersectionObserver.
 * Les animations elles-mêmes sont en CSS (globals.css, « Motion »).
 */

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia?.(REDUCE_QUERY);
  mq?.addEventListener?.("change", cb);
  return () => mq?.removeEventListener?.("change", cb);
}

/**
 * Vrai si la personne demande moins d'animations.
 * Côté serveur : vrai (on rend l'état final, figé, complet). Le client corrige à l'hydratation.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia?.(REDUCE_QUERY).matches ?? false,
    () => true,
  );
}

/** Vrai quand l'élément est (au moins à `threshold`) dans l'écran. Sans IntersectionObserver : toujours vrai. */
export function useInView(ref: RefObject<Element | null>, { threshold = 0, rootMargin = "0px" }: { threshold?: number; rootMargin?: string } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setInView(e?.isIntersecting ?? false), { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, rootMargin]);
  return inView;
}

const PAUSE_KEY = "koudmen_animations_pause";

/** Choix « pause » mémorisé sur cet appareil (confort seulement : absent = animations actives). */
export function usePausePreference(): [boolean, (v: boolean) => void] {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PAUSE_KEY) === "1") setPaused(true);
    } catch {
      /* stockage indisponible : on garde la valeur par défaut */
    }
  }, []);
  const update = (v: boolean) => {
    setPaused(v);
    try {
      if (v) window.localStorage.setItem(PAUSE_KEY, "1");
      else window.localStorage.removeItem(PAUSE_KEY);
    } catch {
      /* stockage indisponible */
    }
  };
  return [paused, update];
}
