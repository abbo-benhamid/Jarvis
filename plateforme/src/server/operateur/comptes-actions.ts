"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { operatorVerifyEmail } from "@/server/auth/registration";
import { fail, type ActionResult } from "@/lib/action-result";
import { accordSchema, recordElderAccord } from "./accord";

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

const verifySchema = z.object({ userId: z.string().cuid(), confirm: z.literal("on", { message: "Appelez d'abord la personne au numéro du compte." }) });

/** L3 / J31 : validation manuelle de l'e-mail, seulement après un appel au numéro du compte. */
export async function verifyEmailManuallyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = verifySchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Demande invalide.");
  const ok = await operatorVerifyEmail(user, parsed.data.userId);
  revalidatePath("/operateur/comptes");
  return ok ? { ok: true, message: "Adresse e-mail validée. L'action est journalisée." } : fail("Ce compte est déjà validé, ou il n'existe pas.");
}

/** R5 (J5) : enregistre la réponse de l'aîné après l'appel du conseiller. */
export async function recordAccordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = accordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez les champs en rouge.", parsed.error.flatten().fieldErrors);
  const r = await recordElderAccord(user, parsed.data);
  revalidatePath("/operateur/aines");
  return r.ok ? { ok: true, message: "Réponse de l'aîné enregistrée." } : fail(r.error);
}
