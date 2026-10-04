"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { orientationSchema, type OrientationResult } from "@/server/rules/orientation";
import { fail, type ActionResult } from "@/lib/action-result";
import {
  acceptSchema,
  codeCheckInSchema,
  declarationSchema,
  declineSchema,
  formDataToObject,
  gpsCheckInSchema,
  kayeSchema,
  profileSchema,
  visitIdSchema,
} from "./rules";
import {
  AccompagnantError,
  acceptProposal,
  checkInWithCode,
  checkInWithGps,
  checkOut,
  createKaye,
  declareVerification,
  declineProposal,
  saveOrientation,
  saveProfile,
  submitForReview,
  type Actor,
} from "./service";

/**
 * Server Actions du Lot B. Ordre fixe (RM-16) :
 * 1. requireRole("ACCOMPAGNANT") ; 2. validation Zod ; 3. service (contrôle de propriété + écriture).
 */

async function actor(): Promise<Actor> {
  const u = await requireRole("ACCOMPAGNANT");
  return { id: u.id, role: u.role, firstName: u.firstName };
}

function toFailure(e: unknown): ActionResult<never> {
  if (e instanceof AccompagnantError) return fail(e.message);
  throw e;
}

const CHECK = "Vérifiez les champs en rouge.";

// ─────────────────────────────── A2 ───────────────────────────────

export async function saveOrientationAction(
  _prev: ActionResult<OrientationResult>,
  formData: FormData,
): Promise<ActionResult<OrientationResult>> {
  const me = await actor();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("answers") ?? ""));
  } catch {
    return fail("Répondez aux 5 questions.");
  }
  const parsed = orientationSchema.safeParse(raw);
  if (!parsed.success) return fail("Répondez aux 5 questions.");
  try {
    const result = await saveOrientation(me, parsed.data);
    revalidatePath("/accompagnant", "layout");
    return { ok: true, data: result };
  } catch (e) {
    return toFailure(e);
  }
}

// ─────────────────────────────── A3 ───────────────────────────────

export async function saveProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = profileSchema.safeParse(formDataToObject(formData, ["communes", "availabilities"]));
  if (!parsed.success) return fail(CHECK, parsed.error.flatten().fieldErrors);
  try {
    await saveProfile(me, parsed.data);
    revalidatePath("/accompagnant", "layout");
    return { ok: true, message: "Profil enregistré." };
  } catch (e) {
    if (e instanceof AccompagnantError && e.code === "TARIF") {
      return fail(e.message, { hourlyRate: [e.message] });
    }
    return toFailure(e);
  }
}

// ─────────────────────────────── A4 ───────────────────────────────

export async function declareVerificationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = declarationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fail(CHECK, parsed.error.flatten().fieldErrors);
  try {
    await declareVerification(me, parsed.data.itemId, parsed.data.declaration);
    revalidatePath("/accompagnant", "layout");
    return { ok: true, message: "Déclaration enregistrée." };
  } catch (e) {
    return toFailure(e);
  }
}

export async function submitForReviewAction(_prev: ActionResult): Promise<ActionResult> {
  const me = await actor();
  try {
    await submitForReview(me);
    revalidatePath("/accompagnant", "layout");
    return { ok: true, message: "Demande envoyée. L'équipe Koudmen vérifie votre profil." };
  } catch (e) {
    return toFailure(e);
  }
}

// ─────────────────────────────── A5 ───────────────────────────────

export async function acceptProposalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = acceptSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fail("Proposition introuvable.");
  let visits: number;
  try {
    visits = (await acceptProposal(me, parsed.data.proposalId)).visitCount;
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/accompagnant", "layout");
  redirect(`/accompagnant/visites?acceptee=${visits}`);
}

export async function declineProposalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = declineSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fail(CHECK, parsed.error.flatten().fieldErrors);
  try {
    await declineProposal(me, parsed.data.proposalId, parsed.data.declineNote);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/accompagnant", "layout");
  redirect("/accompagnant/propositions?refus=ok");
}

// ─────────────────────────────── A7 ───────────────────────────────

export type CheckInData = { valid: boolean; distanceMeters?: number; reason?: string };

export async function gpsCheckInAction(_prev: ActionResult<CheckInData>, formData: FormData): Promise<ActionResult<CheckInData>> {
  const me = await actor();
  const parsed = gpsCheckInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const consent = parsed.error.flatten().fieldErrors.consent;
    return fail(consent ? consent[0]! : "Position illisible. Réessayez ou utilisez le code du domicile.");
  }
  try {
    const r = await checkInWithGps(me, parsed.data);
    revalidatePath(`/accompagnant/visites/${parsed.data.visitId}`);
    return {
      ok: true,
      data: r,
      message: r.valid
        ? "Position enregistrée : vous êtes au domicile."
        : r.reason === "PRECISION_FAIBLE"
          ? "Position trop imprécise. Saisissez le code du domicile."
          : `Position à ${r.distanceMeters} m du domicile : trop loin. Saisissez le code du domicile.`,
    };
  } catch (e) {
    return toFailure(e);
  }
}

export async function simulateGpsAction(_prev: ActionResult<CheckInData>, formData: FormData): Promise<ActionResult<CheckInData>> {
  const me = await actor();
  const parsed = visitIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fail("Visite introuvable.");
  try {
    const r = await checkInWithGps(me, { visitId: parsed.data.visitId, simulated: true });
    revalidatePath(`/accompagnant/visites/${parsed.data.visitId}`);
    return { ok: true, data: r, message: "Position simulée enregistrée (mode test)." };
  } catch (e) {
    return toFailure(e);
  }
}

export async function codeCheckInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = codeCheckInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fail(CHECK, parsed.error.flatten().fieldErrors);
  try {
    await checkInWithCode(me, parsed.data.visitId, parsed.data.code);
    revalidatePath(`/accompagnant/visites/${parsed.data.visitId}`);
    return { ok: true, message: "Code correct. Preuve enregistrée." };
  } catch (e) {
    return toFailure(e);
  }
}

export async function checkOutAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = visitIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fail("Visite introuvable.");
  try {
    await checkOut(me, parsed.data.visitId);
    revalidatePath("/accompagnant", "layout");
    return { ok: true, message: "Check-out enregistré. Écrivez maintenant le Kayé." };
  } catch (e) {
    return toFailure(e);
  }
}

// ─────────────────────────────── A8 ───────────────────────────────

export async function createKayeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = kayeSchema.safeParse(formDataToObject(formData, ["activities"]));
  if (!parsed.success) return fail(CHECK, parsed.error.flatten().fieldErrors);
  try {
    await createKaye(me, parsed.data);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/accompagnant", "layout");
  redirect(`/accompagnant/visites/${parsed.data.visitId}/kaye?envoye=1`);
}
