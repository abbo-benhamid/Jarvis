"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { fail, type ActionResult } from "@/lib/action-result";
import { getPlan } from "@/lib/plans";
import { ActivationError, handleActivation, requestActivation } from "./activation";
import { CRENEAUX, SUJETS_RAPPEL } from "@/lib/rappel";

const requestSchema = z.object({
  plan: z.enum(SUJETS_RAPPEL, { message: "Choisissez le sujet de l'appel." }),
  aineId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().cuid().optional()),
  // L1d (M4) : numéro obligatoire (le conseiller doit pouvoir appeler) et créneau.
  phone: z
    .string({ message: "Entrez le numéro où le conseiller vous appelle." })
    .trim()
    .min(1, "Entrez le numéro où le conseiller vous appelle.")
    .regex(/^\+?[0-9 .-]{6,20}$/, "Saisissez un numéro valide (exemple : +33 6 12 34 56 78)."),
  creneau: z.enum(CRENEAUX, { message: "Choisissez un créneau." }),
});

/** L4 : la famille demande l'appel d'un conseiller pour une formule payante. Aucun paiement. */
export async function requestActivationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = requestSchema.safeParse({
    plan: formData.get("plan") ?? undefined,
    aineId: formData.get("aineId") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    creneau: formData.get("creneau") ?? undefined,
  });
  if (!parsed.success) return fail("Vérifiez les champs en rouge.", parsed.error.flatten().fieldErrors);
  const { plan, phone, creneau } = parsed.data;
  try {
    const r = await requestActivation(user, { plan: plan === "QUESTION" ? null : plan, aineId: parsed.data.aineId ?? null, phone, creneau });
    revalidatePath("/famille/formule");
    revalidatePath("/famille");
    const subject = plan === "QUESTION" ? "pour votre question" : `pour la formule ${getPlan(plan).name}`;
    return {
      ok: true,
      message: r.created
        ? `Demande envoyée ${subject}. Un conseiller Koudmen vous appelle au ${phone}. Aucun paiement n'est demandé.`
        : `Votre demande ${subject} est déjà envoyée. Un conseiller Koudmen vous appelle au ${phone}.`,
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
