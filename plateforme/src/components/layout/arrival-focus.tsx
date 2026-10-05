"use client";

import { useEffect } from "react";

/**
 * UX V1 M1 : après « Commencer le test » (redirection vers `?bienvenue=1`), la page s'ouvrait déjà défilée
 * (défilement de /tester gardé, ou segment amené dans la vue par le routeur). On force le HAUT de la page,
 * puis le focus va sur le titre h1 (lecteur d'écran : « Bonjou, Nadia »).
 * Deux passes (image suivante + court délai) : le routeur de Next peut défiler après le premier rendu.
 */
export function toTopAndFocusTitle(win: Pick<Window, "scrollTo"> = window, doc: Pick<Document, "querySelector"> = document): void {
  win.scrollTo(0, 0);
  const h1 = doc.querySelector<HTMLElement>("main h1, h1");
  if (h1) {
    if (!h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
    h1.focus({ preventScroll: true });
  }
}

export function ArrivalFocus() {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("bienvenue")) return;
    toTopAndFocusTitle();
    const raf = window.requestAnimationFrame(() => toTopAndFocusTitle());
    const t = window.setTimeout(() => window.scrollTo(0, 0), 150);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);
  return null;
}
