/**
 * Convention de retour des Server Actions (tous les lots).
 * - ok: true  → succès, `data` optionnelle.
 * - ok: false → `error` (message pour l'utilisateur) et `fieldErrors` (par champ).
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const initialActionState: ActionResult = { ok: false, error: "" };

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
