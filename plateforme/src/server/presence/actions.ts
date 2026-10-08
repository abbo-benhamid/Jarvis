"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { ActionResult } from "@/lib/action-result";
import { PresenceError, regenerateHomeCard } from "./home-card";
import { decideVisitReview, ReviewError } from "./review";

const schema = z.object({ aineId: z.string().min(1).max(64), confirm: z.literal("oui") });

// L1d (D11) : plus d'action « personne désignée » pour la famille. L'aîné choisit pendant l'appel d'accord ;
// le conseiller l'enregistre (`recordAccordAction`, `recordTripViewerChoiceAction` dans operateur/comptes-actions).

const reviewSchema =z.object({ visitId: z.string().min(1).max(64), decision: z.enum(["CONFIRMER", "SIGNALER"]) });

/** L1-B (R7) : la famille employeur tranche une visite « À vérifier ». Contrôles dans decideVisitReview(). */
export async function decideVisitReviewAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = reviewSchema.safeParse({ visitId: formData.get("visitId"), decision: formData.get("decision") });
  if (!parsed.success) return { ok: false, error: "Choisissez une réponse." };
  try {
    const r = await decideVisitReview(user, parsed.data.visitId, parsed.data.decision);
    revalidatePath("/famille/visites");
    revalidatePath("/famille");
    return {
      ok: true,
      message:
        parsed.data.decision === "CONFIRMER"
          ? r.status === "VALIDEE"
            ? "Merci. La visite est validée."
            : "Merci. Votre confirmation est enregistrée."
          : "Merci. L'équipe Koudmen est prévenue et vous appelle.",
    };
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message };
    throw e;
  }
}

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
