"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { hashPassword, verifyPassword, verifyPasswordForUnknownAccount } from "./password";
import { createSession, destroySession, readSession } from "./session";
import { loginSchema, registerSchema, safeNextPath } from "./validation";
import { DEMO_ACCOUNTS, type DemoRole } from "./demo";
import { isDemoMode, registrationOpen, validTesterCode } from "@/server/env";
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
 * Inscription libre (comptes du monde réel). A10 / M1 : FERMÉE si DEMO_MODE n'est pas "true".
 * Les testeurs entrent seulement par le bac à sable (/tester).
 */
export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!registrationOpen()) redirect("/tester");
  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: "Vérifiez les champs en rouge.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const limited = await hitRateLimit("code-testeur:ip", await clientIp());
  if (!limited.allowed) return { ok: false, error: retryMessage(limited.retryAfterSeconds) };
  // D3 : l'inscription demande un code d'invitation testeur valide.
  const testerCode = validTesterCode(v.testerCode);
  if (!testerCode) {
    return { ok: false, error: "Ce code testeur n'est pas valide.", fieldErrors: { testerCode: ["Code testeur inconnu. Vérifiez le code reçu."] } };
  }
  const existing = await db.user.findUnique({ where: { email: v.email } });
  if (existing) {
    return { ok: false, error: "Un compte existe déjà avec cet email.", fieldErrors: { email: ["Email déjà utilisé."] } };
  }
  const user = await db.user.create({
    data: {
      email: v.email,
      passwordHash: await hashPassword(v.password),
      role: v.role,
      firstName: v.firstName,
      lastName: v.lastName,
      lastLoginAt: new Date(),
      ...(v.role === "FAMILLE"
        ? { familyProfile: { create: { location: v.location ?? "MARTINIQUE", city: v.city || null } } }
        : { caregiverProfile: { create: { allowedLevels: [], communes: [] } } }),
    },
  });
  await logAudit({
    actor: { id: user.id, role: user.role },
    action: "auth.register",
    entityType: "User",
    entityId: user.id,
    metadata: { testerCode, cguAccepted: true },
  });
  await createSession({ sub: user.id, role: user.role, name: user.firstName, demo: false, sv: user.sessionVersion });
  // `next` (ex. lien d'invitation Lakou) : chemin interne seulement.
  redirect(safeNextPath(v.next) ?? (user.role === "ACCOMPAGNANT" ? "/accompagnant/orientation" : ROLE_HOME[user.role]));
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
  if (user.sandboxId) return { ok: false, error: "Ce compte de test s'ouvre avec votre lien de reprise." };
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
