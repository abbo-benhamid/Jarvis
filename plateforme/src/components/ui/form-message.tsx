"use client";

import { useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action-result";
import { Alert } from "./alert";

/**
 * Message générique « champs en rouge » du serveur → texte qui ne dépend pas de la couleur (WCAG 1.3.3, S1b-ux m11).
 * V1c (UX M7) : le message est placé EN HAUT du formulaire, au-dessus des champs : « ci-dessous » est juste.
 * Exporté pour les tests.
 */
export function errorText(state: { error: string; fieldErrors?: Record<string, string[] | undefined> }): string {
  if (!/champs en rouge/.test(state.error)) return state.error;
  const n = Object.values(state.fieldErrors ?? {}).filter((v) => v && v.length > 0).length;
  if (n === 1) return "Corrigez le champ signalé ci-dessous.";
  if (n > 1) return `Corrigez les ${n} champs signalés ci-dessous.`;
  return "Corrigez les champs signalés ci-dessous.";
}

/**
 * Affiche le résultat global d'une Server Action (succès ou erreur).
 * V1c (UX M7, WCAG 3.3.1) : à chaque nouvelle erreur, le focus va sur le message (et la page y défile).
 * Le lecteur d'écran lit le message ; l'utilisateur n'a pas à le chercher.
 */
export function FormMessage({ state }: { state: ActionResult<unknown> | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const error = state && !state.ok ? state.error : "";
  useEffect(() => {
    if (!error || !ref.current) return;
    ref.current.focus({ preventScroll: true });
    ref.current.scrollIntoView?.({ block: "center" });
    // `state` change à chaque envoi : une même erreur renvoyée reprend le focus.
  }, [state, error]);
  if (!state) return null;
  if (state.ok) return state.message ? <Alert tone="succes">{state.message}</Alert> : null;
  if (!state.error) return null;
  return (
    <div ref={ref} tabIndex={-1} className="rounded-md outline-offset-2">
      <Alert tone="danger">{errorText(state)}</Alert>
    </div>
  );
}
