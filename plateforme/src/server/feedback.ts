"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/guards";
import type { ActionResult } from "@/lib/action-result";

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choisissez une note de 1 à 5.").max(5),
  message: z.string().trim().min(3, "Écrivez au moins quelques mots.").max(2000, "2000 caractères maximum."),
  pagePath: z.string().trim().max(300).default("/"),
});

/** Bouton « Donner mon avis » : fonctionne connecté ou non. */
export async function submitFeedbackAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse({
    rating: formData.get("rating"),
    message: formData.get("message"),
    pagePath: formData.get("pagePath") ?? "/",
  });
  if (!parsed.success) {
    return { ok: false, error: "Vérifiez votre avis.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const user = await getCurrentUser();
  const h = await headers();
  await db.feedback.create({
    data: {
      rating: parsed.data.rating,
      message: parsed.data.message,
      pagePath: parsed.data.pagePath.startsWith("/") ? parsed.data.pagePath : "/",
      userId: user?.id ?? null,
      role: user?.role ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  return { ok: true, message: "Merci ! Votre avis aide à améliorer Koudmen." };
}
