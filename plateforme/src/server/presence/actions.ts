"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { ActionResult } from "@/lib/action-result";
import { PresenceError, regenerateHomeCard } from "./home-card";

const schema = z.object({ aineId: z.string().min(1).max(64), confirm: z.literal("oui") });

/**
 * L1-B (L9) : nouvelle carte domicile (version + 1). Famille (propriétaire ou payeur) ou opérateur.
 * Les contrôles d'accès sont dans regenerateHomeCard().
 */
export async function regenerateHomeCardAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE", "OPERATEUR");
  const parsed = schema.safeParse({ aineId: formData.get("aineId"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, error: "Cochez la case pour confirmer." };
  try {
    const { version } = await regenerateHomeCard(user, parsed.data.aineId);
    revalidatePath(`/famille/aines/${parsed.data.aineId}/carte-domicile`);
    revalidatePath(`/operateur/aines/${parsed.data.aineId}/carte-domicile`);
    return { ok: true, message: `Nouvelle carte créée (version ${version}). L'ancienne carte ne marche plus : imprimez celle-ci et remplacez-la.` };
  } catch (e) {
    if (e instanceof PresenceError) return { ok: false, error: e.message };
    throw e;
  }
}
