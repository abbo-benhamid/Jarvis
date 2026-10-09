"use server";

import { z } from "zod";
import { clientIp, retryMessage } from "@/server/rate-limit";
import { joinWaitlist } from "@/server/waitlist";
import { territoireSchema } from "@/contracts/v1/territoires";
import type { ActionResult } from "@/lib/action-result";

/** Message unique (aucune fuite : même texte si l'adresse est déjà inscrite). */
export const WAITLIST_DONE =
  "C'est noté. Si l'adresse est valide, Koudmen vous écrit à l'ouverture dans ce territoire. Vous pouvez retirer votre accord à tout moment : écrivez-nous.";

const schema = z.object({
  email: z.string({ message: "Entrez votre adresse e-mail." }).trim().toLowerCase().email("Adresse e-mail invalide.").max(254),
  territoire: territoireSchema,
  consentement: z.literal("on", { message: "Cochez la case pour vous inscrire sur la liste d'attente." }),
});

/** T1 (T2) : inscription sur la liste d'attente depuis le site web. */
export async function joinWaitlistAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({
    email: formData.get("email") ?? undefined,
    territoire: formData.get("territoire") ?? undefined,
    consentement: formData.get("consentement") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Vérifiez les champs en rouge.", fieldErrors: parsed.error.flatten().fieldErrors };
  const r = await joinWaitlist({ email: parsed.data.email, territoire: parsed.data.territoire, ip: await clientIp() });
  if (!r.ok) return { ok: false, error: retryMessage(r.retryAfterSeconds) };
  return { ok: true, message: WAITLIST_DONE };
}
