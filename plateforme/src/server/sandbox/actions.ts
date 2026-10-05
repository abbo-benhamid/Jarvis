"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { getCurrentUser, requireRole } from "@/server/auth/guards";
import { validTesterCode } from "@/server/env";
import { logAudit } from "@/server/audit";
import { clientIp, hitRateLimit, hitRateLimits, retryMessage } from "@/server/rate-limit";
import { fail, type ActionResult } from "@/lib/action-result";
import { DISCOVERY_CONSENT_TEXT, isValidMicroAnswer } from "@/lib/measure";
import { createSandbox, SandboxError } from "./service";
import { simulateNext, type SimulationResult } from "./robots";
import { trackEvent } from "./events";

/**
 * Actions du bac à sable (D2, D3, D14, D15). Chaque action vérifie la session ET le bac à sable.
 */

const startSchema = z.object({
  testerCode: z.string().trim().min(1, "Saisissez votre code testeur.").max(40),
  role: z.enum(["FAMILLE", "ACCOMPAGNANT"], { message: "Choisissez le rôle que vous jouez." }),
  firstName: z
    .string()
    .trim()
    .max(40, "40 caractères maximum.")
    .optional()
    .transform((v) => v || undefined),
  acceptCgu: z.literal("on", { message: "Acceptez les conditions d'utilisation du test." }),
  adult: z.literal("on", { message: "Le test est réservé aux personnes de 18 ans ou plus." }),
  acceptTest: z.literal("on", { message: "Confirmez que vous utilisez uniquement des données fictives." }),
});

/** Durée maximale du verrou de « Simuler la suite » (libéré dès la fin de l'étape). */
const SIMULATION_LEASE_MS = 60_000;

function hashWithdrawToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** « Tester Koudmen » : code valide + CGU de test → un bac à sable neuf pour CE testeur. */
export async function startSandboxAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = startSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez les champs en rouge.", parsed.error.flatten().fieldErrors);
  // B1 : limite d'essais par IP (codes devinés en masse, bacs à sable créés en masse).
  const limited = await hitRateLimit("code-testeur:ip", await clientIp());
  if (!limited.allowed) {
    await logAudit({ action: "sandbox.rate_limited", entityType: "Sandbox" });
    return fail(retryMessage(limited.retryAfterSeconds));
  }
  const code = validTesterCode(parsed.data.testerCode);
  if (!code) return fail("Ce code testeur n'est pas valide.", { testerCode: ["Code inconnu. Vérifiez le code reçu avec votre invitation."] });
  let role: "FAMILLE" | "ACCOMPAGNANT";
  try {
    ({ role } = await createSandbox({
      testerCode: code,
      role: parsed.data.role,
      firstName: parsed.data.firstName ?? (parsed.data.role === "FAMILLE" ? "Nadia" : "Ghislaine"),
    }));
  } catch (e) {
    if (e instanceof SandboxError) return fail(e.message);
    throw e;
  }
  redirect(role === "FAMILLE" ? "/famille?bienvenue=1" : "/accompagnant?bienvenue=1");
}

async function sandboxTester() {
  const user = await requireRole("FAMILLE", "ACCOMPAGNANT");
  if (!user.sandboxId || (user.role !== "FAMILLE" && user.role !== "ACCOMPAGNANT")) return null;
  return { ...user, role: user.role, sandboxId: user.sandboxId };
}

/** « Simuler la suite » (D14) : les robots jouent l'étape suivante. */
export async function simulateAction(_prev: ActionResult<SimulationResult>): Promise<ActionResult<SimulationResult>> {
  const tester = await sandboxTester();
  if (!tester) return fail("La simulation existe seulement dans un bac à sable de test.");
  // m2 : une seule simulation à la fois par bac à sable (double clic, deux onglets). Bail atomique de 60 s.
  const now = new Date();
  const lease = await db.sandbox.updateMany({
    where: { id: tester.sandboxId, OR: [{ simulationLockedUntil: null }, { simulationLockedUntil: { lt: now } }] },
    data: { simulationLockedUntil: new Date(now.getTime() + SIMULATION_LEASE_MS) },
  });
  if (lease.count !== 1) return fail("Une simulation est déjà en cours. Attendez quelques secondes.");
  let result: SimulationResult;
  try {
    result = await simulateNext(tester);
  } finally {
    await db.sandbox.update({ where: { id: tester.sandboxId }, data: { simulationLockedUntil: null } });
  }
  await db.sandbox.update({ where: { id: tester.sandboxId }, data: { simulationCount: { increment: 1 }, lastSeenAt: new Date() } });
  await trackEvent(tester, "simulate.step", { metadata: { step: result.step, acted: result.acted } });
  revalidatePath("/", "layout");
  return { ok: true, data: result, message: result.message };
}

const microSchema = z.object({ questionKey: z.string().max(40), answer: z.string().max(40), path: z.string().max(200).optional() });

/** Micro-question (D15) : une réponse par compte et par question. */
export async function microAnswerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour répondre.");
  const parsed = microSchema.safeParse(formToObject(formData));
  if (!parsed.success || !isValidMicroAnswer(parsed.data.questionKey, parsed.data.answer)) return fail("Choisissez une réponse.");
  const sandbox = user.sandboxId ? await db.sandbox.findUnique({ where: { id: user.sandboxId }, select: { testerCode: true } }) : null;
  await db.microAnswer.upsert({
    where: { userId_questionKey: { userId: user.id, questionKey: parsed.data.questionKey } },
    create: {
      userId: user.id,
      role: user.role,
      sandboxId: user.sandboxId,
      testerCode: sandbox?.testerCode ?? null,
      questionKey: parsed.data.questionKey,
      answer: parsed.data.answer,
    },
    update: { answer: parsed.data.answer },
  });
  await trackEvent(user, "micro.answered", { path: parsed.data.path, metadata: { question: parsed.data.questionKey } });
  return { ok: true, message: "Merci ! Votre réponse aide l'équipe." };
}

const discoverySchema = z.object({
  name: z.string().trim().min(1, "Écrivez votre prénom.").max(80, "80 caractères maximum."),
  contact: z.string().trim().min(5, "Écrivez un email ou un numéro de téléphone.").max(120, "120 caractères maximum."),
  consent: z.literal("on", { message: "Cochez la case pour nous autoriser à vous recontacter." }),
});

/**
 * Offre factice « Réserver une vraie visite découverte » (D15).
 * Contact RÉEL du testeur, recueilli SEULEMENT avec son consentement explicite. Aucune donnée sur l'aîné.
 */
export async function requestDiscoveryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("FAMILLE");
  const parsed = discoverySchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Vérifiez les champs en rouge.", parsed.error.flatten().fieldErrors);
  const limited = await hitRateLimits([
    ["decouverte:compte", user.id],
    ["decouverte:ip", await clientIp()],
  ]);
  if (!limited.allowed) return fail(retryMessage(limited.retryAfterSeconds));
  const sandbox = user.sandboxId ? await db.sandbox.findUnique({ where: { id: user.sandboxId }, select: { testerCode: true } }) : null;
  const now = new Date();
  // M6 : lien « Retirer mon accord ». La base garde seulement l'empreinte SHA-256 du jeton.
  const withdrawToken = randomBytes(24).toString("base64url");
  const created = await db.discoveryRequest.create({
    data: {
      userId: user.id,
      sandboxId: user.sandboxId,
      testerCode: sandbox?.testerCode ?? null,
      name: parsed.data.name,
      contact: parsed.data.contact,
      consentText: DISCOVERY_CONSENT_TEXT,
      consentAt: now,
      withdrawTokenHash: hashWithdrawToken(withdrawToken),
    },
    select: { id: true },
  });
  // Jamais le contact dans l'audit ni dans les événements.
  await logAudit({ actor: user, action: "discovery.requested", entityType: "DiscoveryRequest", entityId: created.id });
  await trackEvent(user, "discovery.requested");
  revalidatePath("/", "layout");
  // Le lien de retrait s'affiche une seule fois, sur la page de confirmation (le testeur le garde).
  redirect(`/famille/visite-decouverte?envoye=1&retrait=${withdrawToken}`);
}

const withdrawSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) });

/**
 * Retrait du consentement PAR LIEN (M6), sans compte : le contact est EFFACÉ (pas seulement marqué).
 * Fonctionne après la purge du bac à sable (le contact vit jusqu'à 6 mois).
 */
export async function withdrawDiscoveryByTokenAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = withdrawSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Ce lien n'est pas valable.");
  const limited = await hitRateLimit("retrait:ip", await clientIp());
  if (!limited.allowed) return fail(retryMessage(limited.retryAfterSeconds));
  const found = await db.discoveryRequest.findUnique({ where: { withdrawTokenHash: hashWithdrawToken(parsed.data.token) }, select: { id: true } });
  if (!found) return fail("Ce lien n'est plus valable : votre accord est déjà retiré, ou votre contact est déjà effacé.");
  await db.$transaction(async (tx) => {
    await tx.discoveryRequest.delete({ where: { id: found.id } });
    await logAudit({ action: "discovery.withdrawn", entityType: "DiscoveryRequest", entityId: found.id, metadata: { via: "lien" } }, tx);
  });
  return { ok: true, message: "Votre accord est retiré. Nous avons effacé votre prénom et votre contact." };
}

/** Retrait du consentement depuis l'espace du testeur connecté : efface SES demandes de visite découverte. */
export async function withdrawMyDiscoveryAction(): Promise<void> {
  const user = await requireRole("FAMILLE");
  const mine = await db.discoveryRequest.findMany({ where: { userId: user.id }, select: { id: true } });
  if (mine.length > 0) {
    await db.$transaction(async (tx) => {
      await tx.discoveryRequest.deleteMany({ where: { id: { in: mine.map((d) => d.id) } } });
      for (const d of mine) {
        await logAudit({ actor: user, action: "discovery.withdrawn", entityType: "DiscoveryRequest", entityId: d.id, metadata: { via: "espace" } }, tx);
      }
    });
  }
  revalidatePath("/", "layout");
  redirect("/famille/visite-decouverte?retire=1");
}

/** « Non, pas maintenant » : la réponse compte aussi (mesure de la volonté de payer). */
export async function declineDiscoveryAction(): Promise<void> {
  const user = await requireRole("FAMILLE");
  await trackEvent(user, "discovery.declined");
  revalidatePath("/", "layout");
  redirect("/famille/visite-decouverte?refus=1");
}
