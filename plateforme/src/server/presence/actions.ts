"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import type { ActionResult } from "@/lib/action-result";
import { PresenceError, regenerateHomeCard } from "./home-card";
import { decideVisitReview, ReviewError } from "./review";

const schema = z.object({ aineId: z.string().min(1).max(64), confirm: z.literal("oui") });
const viewerSchema = z.object({ aineId: z.string().min(1).max(64), viewerId: z.string().max(64) });

/**
 * L1-B (R4) : le payeur choisit la « personne désignée » qui voit le trajet en direct, en plus de lui-même.
 * Vide = personne d'autre. La personne doit être membre du cercle Lakou. Journalisé.
 */
export async function setTripViewerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = viewerSchema.safeParse({ aineId: formData.get("aineId"), viewerId: formData.get("viewerId") ?? "" });
  if (!parsed.success) return { ok: false, error: "Choisissez une personne." };
  const { aineId, viewerId } = parsed.data;
  const members = await db.lakouMember.findMany({ where: { aineId }, select: { userId: true, isPayer: true } });
  if (!members.some((m) => m.userId === user.id && m.isPayer)) return { ok: false, error: "Seul le gestionnaire principal du profil choisit cette personne." };
  if (viewerId && !members.some((m) => m.userId === viewerId)) return { ok: false, error: "Cette personne n'est pas dans le cercle Lakou." };
  await db.aine.update({ where: { id: aineId }, data: { tripViewerId: viewerId || null } });
  await logAudit({ actor: user, action: "aine.trip_viewer.set", entityType: "Aine", entityId: aineId, metadata: { designated: Boolean(viewerId) } });
  revalidatePath(`/famille/aines/${aineId}`);
  return { ok: true, message: viewerId ? "Personne désignée enregistrée." : "Plus personne d'autre ne voit le trajet." };
}

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
