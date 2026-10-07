"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { verifyPassword, verifyPasswordForUnknownAccount } from "./password";
import { createSession, destroySession, readSession } from "./session";
import { forgotPasswordSchema, loginSchema, newPasswordSchema, registerSchema, safeNextPath } from "./validation";
import { DEMO_ACCOUNTS, type DemoRole } from "./demo";
import { registerAccount, requestPasswordReset, resendVerification, resetPassword, verifyEmailToken } from "./registration";
import { isDemoMode, isLaunchMode } from "@/server/env";
import { logAudit } from "@/server/audit";
import { clientIp, hitRateLimit, hitRateLimits, retryMessage } from "@/server/rate-limit";
import { ROLE_HOME } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * L2 : inscription OUVERTE (famille ou accompagnant), dans tous les modes.
 * Aucune fuite d'existence de compte : e-mail connu ou non, la page suivante est la même
 * (« Vérifiez votre boîte mail ») et un e-mail part dans les deux cas. Pas de connexion automatique :
 * la personne se connecte avec son mot de passe (elle peut le faire tout de suite, avant la vérification).
 */
export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: "Vérifiez les champs en rouge.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const limited = await hitRateLimit("inscription:ip", await clientIp());
  if (!limited.allowed) {
    await logAudit({ action: "auth.register_rate_limited", entityType: "User" });
    return { ok: false, error: retryMessage(limited.retryAfterSeconds) };
  }
  const r = await registerAccount({
    role: v.role,
    firstName: v.firstName,
    lastName: v.lastName,
    email: v.email,
    password: v.password,
    phone: v.phone ?? null,
    commune: v.role === "ACCOMPAGNANT" ? (v.commune ?? null) : null,
    location: v.role === "FAMILLE" ? (v.location ?? null) : null,
    city: v.role === "FAMILLE" ? (v.city ?? null) : null,
    birthDate: v.role === "ACCOMPAGNANT" ? (v.birthDate ?? null) : null,
    newsOptIn: v.newsOptIn === "on",
    via: "web",
  });
  if (!r.ok) return { ok: false, error: "Vérifiez les champs en rouge.", fieldErrors: { [r.field]: [r.message] } };
  const next = safeNextPath(v.next);
  redirect(`/inscription/envoye?role=${v.role}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
}

/** L3 : « mot de passe oublié » (web). Toujours le même message (aucune fuite d'existence de compte). */
export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: "Vérifiez votre adresse e-mail.", fieldErrors: parsed.error.flatten().fieldErrors };
  const limited = await hitRateLimits([
    ["mdp-oublie:ip", await clientIp()],
    ["mdp-oublie:compte", parsed.data.email],
  ]);
  if (limited.allowed) await requestPasswordReset(parsed.data.email);
  else await logAudit({ action: "auth.password_reset_rate_limited", entityType: "User" });
  return { ok: true, message: FORGOT_SENT };
}

/** Message unique après « mot de passe oublié ». */
const FORGOT_SENT =
  "Si un compte existe avec cette adresse, un e-mail part dans quelques minutes. Le lien marche pendant 1 heure. Regardez aussi dans les courriers indésirables.";

/** L3 : nouveau mot de passe par lien. Toutes les sessions sont fermées (sessionVersion). */
export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: "Vérifiez les champs en rouge.", fieldErrors: parsed.error.flatten().fieldErrors };
  const limited = await hitRateLimit("jeton-email:ip", await clientIp());
  if (!limited.allowed) return { ok: false, error: retryMessage(limited.retryAfterSeconds) };
  const r = await resetPassword(parsed.data.token, parsed.data.password);
  if (!r.ok) return r.reason === "MOT_DE_PASSE" ? { ok: false, error: r.message, fieldErrors: { password: [r.message] } } : { ok: false, error: r.message };
  await destroySession();
  redirect("/connexion?info=mot-de-passe-change");
}

/** L3 : confirmation de l'e-mail (bouton sur la page du lien : un robot de messagerie ne consomme pas le lien). */
export async function verifyEmailAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const limited = await hitRateLimit("jeton-email:ip", await clientIp());
  if (!limited.allowed) return { ok: false, error: retryMessage(limited.retryAfterSeconds) };
  const ok = await verifyEmailToken(token);
  if (!ok) return { ok: false, error: "Ce lien ne marche plus. Connectez-vous, puis demandez un nouveau lien." };
  const session = await readSession();
  redirect(session ? ROLE_HOME[session.role] : "/connexion?info=email-verifie");
}

/** L3 : renvoie le lien de vérification au compte connecté. */
export async function resendVerificationAction(_prev: ActionResult): Promise<ActionResult> {
  const session = await readSession();
  if (!session) return { ok: false, error: "Connectez-vous d'abord." };
  const limited = await hitRateLimit("verif-email:compte", session.sub);
  if (!limited.allowed) return { ok: false, error: retryMessage(limited.retryAfterSeconds) };
  await resendVerification(session.sub);
  return { ok: true, message: "Un nouveau lien part dans quelques minutes. Regardez aussi dans les courriers indésirables." };
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: "Vérifiez les champs en rouge.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email, password, next } = parsed.data;
  // M5 : limite d'essais par IP et par compte visé (stockée en base, empreintes seulement).
  const limited = await hitRateLimits([
    ["login:ip", await clientIp()],
    ["login:compte", email],
  ]);
  if (!limited.allowed) {
    await logAudit({ action: "auth.login_rate_limited", entityType: "User" });
    return { ok: false, error: retryMessage(limited.retryAfterSeconds) };
  }
  const user = await db.user.findUnique({ where: { email } });
  // Message identique dans les deux cas : on ne révèle pas si le compte existe.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPasswordForUnknownAccount(password);
  if (!user || !valid) {
    // Audit de l'échec, sans email ni mot de passe (m5).
    await logAudit({ action: "auth.login_failed", entityType: "User", entityId: user?.id ?? null });
    return { ok: false, error: "Email ou mot de passe incorrect." };
  }
  // D1 : les comptes démo partagés sont refusés hors du mode démo.
  if (user.isDemo && !isDemoMode()) return { ok: false, error: "Les comptes de démonstration sont désactivés sur cette version." };
  // D2 : un compte de bac à sable s'ouvre seulement par son lien de reprise.
  if (user.sandboxId) return { ok: false, error: isLaunchMode() ? "Email ou mot de passe incorrect." : "Ce compte de test s'ouvre avec votre lien de reprise." };
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.login", entityType: "User", entityId: user.id });
  await createSession({ sub: user.id, role: user.role, name: user.firstName, demo: user.isDemo, sv: user.sessionVersion });
  redirect(safeNextPath(next) ?? ROLE_HOME[user.role]);
}

/** Mode démo : connexion directe à un compte seedé. Désactivé si DEMO_MODE != "true". */
export async function demoLoginAction(formData: FormData): Promise<void> {
  if (!isDemoMode()) redirect("/connexion?erreur=demo-desactive");
  const role = formData.get("role");
  // D1 : pas de démo « Opérateur ».
  if (role !== "FAMILLE" && role !== "ACCOMPAGNANT") redirect("/");
  const account = DEMO_ACCOUNTS[role as DemoRole];
  const user = await db.user.findUnique({ where: { email: account.email } });
  if (!user || !user.isDemo || user.role === "OPERATEUR") redirect("/connexion?erreur=demo-absent");
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.demo_login", entityType: "User", entityId: user.id });
  await createSession({ sub: user.id, role: user.role, name: user.firstName, demo: true, sv: user.sessionVersion });
  redirect(ROLE_HOME[user.role]);
}

/**
 * Déconnexion RÉELLE (M7) : la version de session du compte est incrémentée, donc tout jeton
 * déjà émis (copié, volé, autre appareil) est refusé. M3 : le cookie de reprise est aussi effacé.
 * X6 (sécurité D1) : compte démo PARTAGÉ → seul ce navigateur est déconnecté (la version de session ne change
 * pas : un visiteur ne coupe pas les autres visiteurs de la démo, web et app).
 */
export async function logoutAction(): Promise<void> {
  const session = await readSession();
  if (session) {
    if (!session.demo) await db.user.updateMany({ where: { id: session.sub }, data: { sessionVersion: { increment: 1 } } });
    await logAudit({
      actor: { id: session.sub, role: session.role },
      action: "auth.logout",
      entityType: "User",
      entityId: session.sub,
      ...(session.demo ? { metadata: { demoPartagee: true } } : {}),
    });
  }
  await destroySession();
  redirect("/");
}
