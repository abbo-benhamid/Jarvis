"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { fail, type ActionResult } from "@/lib/action-result";
import { accordL1dSchema, recordElderAccordL1d } from "./accord-l1d";

const MESSAGES = {
  ACCORD: "Accord enregistré. La famille voit « Accord donné ».",
  REFUS: "Refus enregistré. Aucune visite n'est organisée.",
  RAPPELER: "Rappel noté. Rappelez la personne plus tard. La fiche reste « en attente de l'appel ».",
  RETRAIT: "Retrait de l'accord enregistré.",
} as const;

/** L1d (D14) : réponse de l'aîné après l'appel (oui, non, rappeler plus tard) ou retrait. // L1d: à brancher sur F1 */
export async function recordAccordL1dAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;
  const parsed = accordL1dSchema.safeParse(raw);
  if (!parsed.success) return fail("Vérifiez les champs en rouge.", parsed.error.flatten().fieldErrors);
  const r = await recordElderAccordL1d(user, parsed.data);
  revalidatePath("/operateur/aines");
  revalidatePath("/operateur");
  return r.ok ? { ok: true, message: MESSAGES[parsed.data.resultat] } : fail(r.error);
}
