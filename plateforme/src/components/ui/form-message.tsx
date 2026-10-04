import type { ActionResult } from "@/lib/action-result";
import { Alert } from "./alert";

/** Affiche le résultat global d'une Server Action (succès ou erreur). */
export function FormMessage({ state }: { state: ActionResult<unknown> | undefined }) {
  if (!state) return null;
  if (state.ok) return state.message ? <Alert tone="succes">{state.message}</Alert> : null;
  return state.error ? <Alert tone="danger">{state.error}</Alert> : null;
}
