import type { ActionResult } from "@/lib/action-result";
import { Alert } from "./alert";

/**
 * Message générique « champs en rouge » du serveur → texte qui ne dépend pas de la couleur (WCAG 1.3.3, S1b-ux m11).
 * Exporté pour les tests.
 */
export function errorText(state: { error: string; fieldErrors?: Record<string, string[] | undefined> }): string {
  if (!/champs en rouge/.test(state.error)) return state.error;
  const n = Object.values(state.fieldErrors ?? {}).filter((v) => v && v.length > 0).length;
  if (n === 1) return "Corrigez le champ signalé ci-dessous.";
  if (n > 1) return `Corrigez les ${n} champs signalés ci-dessous.`;
  return "Corrigez les champs signalés ci-dessous.";
}

/** Affiche le résultat global d'une Server Action (succès ou erreur). */
export function FormMessage({ state }: { state: ActionResult<unknown> | undefined }) {
  if (!state) return null;
  if (state.ok) return state.message ? <Alert tone="succes">{state.message}</Alert> : null;
  return state.error ? <Alert tone="danger">{errorText(state)}</Alert> : null;
}
