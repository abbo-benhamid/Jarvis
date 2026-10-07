"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { fail, type ActionResult } from "@/lib/action-result";
import { getPlan } from "@/lib/plans";
import { ActivationError, handleActivation, requestActivation } from "./activation";

const requestSchema = z.object({
  plan: z.enum(["KOZE", "SERENITE"], { message: "Choisissez une formule." }),
  aineId: z.preprocess((v) => (v === "" ? undefined : v), z.string().cuid().optional()),
});

/** L4 : la famille demande l'appel d'un conseiller pour une formule payante. Aucun paiement. */
export async function requestActivationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = requestSchema.safeParse({ plan: formData.get("plan"), aineId: formData.get("aineId") ?? undefined });
  if (!parsed.success) return fail("Choisissez une formule payante.");
  try {
    const r = await requestActivation(user, { plan: parsed.data.plan, aineId: parsed.data.aineId ?? null });
    revalidatePath("/famille/formule");
    const name = getPlan(parsed.data.plan).name;
    return {
      ok: true,
      message: r.created
        ? `Demande envoyée pour la formule ${name}. Un conseiller Koudmen vous appelle. Aucun paiement n'est demandé aujourd'hui.`
        : `Votre demande pour la formule ${name} est déjà envoyée. Un conseiller Koudmen vous appelle.`,
    };
  } catch (e) {
    if (e instanceof ActivationError) return fail(e.message);
    throw e;
  }
}

const handleSchema = z.object({ id: z.string().cuid(), status: z.enum(["RAPPELEE", "CLOSE"]) });

/** L4 : le conseiller note l'appel fait, ou clôt la demande. */
export async function handleActivationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = handleSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return fail("Demande introuvable.");
  const ok = await handleActivation(user, parsed.data.id, parsed.data.status);
  revalidatePath("/operateur/activations");
  return ok ? { ok: true, message: parsed.data.status === "RAPPELEE" ? "Appel noté." : "Demande close." } : fail("Cette demande est déjà close.");
}
