import "server-only";
import type { FamilyLocation, Role } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { logAudit } from "@/server/audit";
import { sendMail } from "@/server/mail";
import { existingAccountEmail, passwordChangedEmail, passwordResetEmail, verificationEmail } from "@/server/mail/templates";
import { COMMUNE_CODES } from "@/lib/communes";
import { CGU_VERSION } from "@/lib/legal-launch";
import { ageInYears, MIN_CAREGIVER_AGE } from "@/server/rules/status-levels";
import { hashPassword, verifyPasswordForUnknownAccount } from "./password";
import { passwordProblem } from "./password-policy";
import { consumeAccountToken, issueAccountToken, peekAccountToken } from "./account-tokens";

/**
 * L2, L3 : création de compte et liens reçus par e-mail. Partagé par le site web (Server Actions) et l'API v1.
 * RÈGLES :
 * - Aucune fuite d'existence de compte : même résultat, même e-mail envoyé (contenu différent), même calcul bcrypt.
 * - Jetons : empreinte en base, usage unique, 24 h (e-mail) et 1 h (mot de passe).
 * - Journal d'audit sans e-mail, sans jeton, sans mot de passe.
 * - R6 (J27) : l'inscription d'un accompagnant est gratuite. Aucun abonnement, aucun paiement n'est créé ici.
 */

export type RegistrationInput = {
  role: Extract<Role, "FAMILLE" | "ACCOMPAGNANT">;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string | null;
  /** Accompagnant : commune de vie (obligatoire). */
  commune: string | null;
  /** Famille : lieu de vie (obligatoire) et ville. */
  location: FamilyLocation | null;
  city: string | null;
  /** Accompagnant : AAAA-MM-JJ (obligatoire). */
  birthDate: string | null;
  newsOptIn: boolean;
  /** Canal (journal) : site web ou app. */
  via: "web" | "api";
};

export type RegistrationField = "password" | "birthDate" | "commune" | "phone" | "location";
export type RegistrationResult = { ok: true } | { ok: false; field: RegistrationField; message: string };

const fail = (field: RegistrationField, message: string): RegistrationResult => ({ ok: false, field, message });

/** AAAA-MM-JJ → Date UTC, ou null si la date n'existe pas. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

/** Contrôles métier (en plus du schéma Zod). Pur : testable seul. */
export function registrationProblem(input: RegistrationInput, now: Date = new Date()): RegistrationResult | null {
  const pw = passwordProblem(input.password, { email: input.email, firstName: input.firstName, lastName: input.lastName });
  if (pw) return fail("password", pw);
  if (input.role === "ACCOMPAGNANT") {
    const birth = parseIsoDate(input.birthDate);
    if (!birth || birth > now || birth.getUTCFullYear() < 1900) return fail("birthDate", "Saisissez votre date de naissance.");
    if (ageInYears(birth, now) < MIN_CAREGIVER_AGE) return fail("birthDate", `Il faut avoir ${MIN_CAREGIVER_AGE} ans ou plus pour accompagner des aînés.`);
    if (!input.commune || !(COMMUNE_CODES as readonly string[]).includes(input.commune)) return fail("commune", "Choisissez votre commune.");
    if (!input.phone) return fail("phone", "Saisissez votre numéro de téléphone.");
  } else if (!input.location) {
    return fail("location", "Indiquez où vous habitez.");
  }
  return null;
}

export function verificationLink(token: string): string {
  return `${appUrl()}/verifier-email?jeton=${encodeURIComponent(token)}`;
}

export function resetLink(token: string): string {
  return `${appUrl()}/mot-de-passe/nouveau?jeton=${encodeURIComponent(token)}`;
}

/** Compte qui reçoit des e-mails de compte (ni démo partagée, ni bac à sable). */
function realAccount(u: { isDemo: boolean; sandboxId: string | null }): boolean {
  return !u.isDemo && u.sandboxId === null;
}

/**
 * Crée un compte, ou (e-mail déjà connu) envoie un e-mail « vous avez déjà un compte ».
 * Le résultat est le même dans les deux cas : l'appelant affiche « Vérifiez votre boîte mail ».
 */
export async function registerAccount(input: RegistrationInput, now: Date = new Date()): Promise<RegistrationResult> {
  const problem = registrationProblem(input, now);
  if (problem) return problem;

  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true, role: true, firstName: true, isDemo: true, sandboxId: true } });
  if (existing) {
    // Même coût de calcul qu'une création (bcrypt), sans rien écrire.
    await verifyPasswordForUnknownAccount(input.password);
    if (realAccount(existing)) {
      const token = await issueAccountToken(existing.id, "MOT_DE_PASSE", now);
      await sendMail(existingAccountEmail(input.email, existing.firstName, `${appUrl()}/connexion`, resetLink(token)));
    }
    await logAudit({ action: "auth.register_existing", entityType: "User", entityId: existing.id, metadata: { via: input.via } });
    return { ok: true };
  }

  const passwordHash = await hashPassword(input.password);
  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        cguAcceptedAt: now,
        cguVersion: CGU_VERSION,
        newsOptInAt: input.newsOptIn ? now : null,
        ...(input.role === "FAMILLE"
          ? { familyProfile: { create: { location: input.location!, city: input.city } } }
          : { caregiverProfile: { create: { allowedLevels: [], communes: [input.commune!], birthDate: parseIsoDate(input.birthDate) } } }),
      },
      select: { id: true, role: true, firstName: true },
    });
    const token = await issueAccountToken(user.id, "VERIFICATION_EMAIL", now, tx);
    await logAudit(
      { actor: { id: user.id, role: user.role }, action: "auth.register", entityType: "User", entityId: user.id, metadata: { via: input.via, cguVersion: CGU_VERSION, newsOptIn: input.newsOptIn } },
      tx,
    );
    return { user, token };
  });
  await sendMail(verificationEmail(input.email, created.user.firstName, verificationLink(created.token)));
  return { ok: true };
}

/** L3 : confirme l'e-mail par le lien reçu. Retourne false si le lien est invalide, expiré ou déjà utilisé. */
export async function verifyEmailToken(token: string, now: Date = new Date()): Promise<boolean> {
  const done = await db.$transaction(async (tx) => {
    const check = await consumeAccountToken(token, "VERIFICATION_EMAIL", now, tx);
    if (!check.ok) return null;
    const user = await tx.user.findUnique({ where: { id: check.userId }, select: { id: true, role: true, emailVerifiedAt: true } });
    if (!user) return null;
    if (!user.emailVerifiedAt) await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now, emailVerifiedVia: "LIEN" } });
    await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.email_verified", entityType: "User", entityId: user.id, metadata: { via: "LIEN" } }, tx);
    return user.id;
  });
  return done !== null;
}

/** L3 : renvoie le lien de vérification (compte connecté, e-mail pas encore confirmé). */
export async function resendVerification(userId: string, now: Date = new Date()): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, firstName: true, emailVerifiedAt: true, isDemo: true, sandboxId: true } });
  if (!user || user.emailVerifiedAt || !realAccount(user)) return false;
  const token = await issueAccountToken(user.id, "VERIFICATION_EMAIL", now);
  await sendMail(verificationEmail(user.email, user.firstName, verificationLink(token)));
  await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.email_verification_resent", entityType: "User", entityId: user.id });
  return true;
}

/**
 * L3 : « mot de passe oublié ». Toujours le même résultat pour l'appelant (aucune fuite).
 * Pas d'e-mail pour un opérateur (compte créé par script, TOTP prévu), un compte démo ou un bac à sable.
 */
export async function requestPasswordReset(email: string, now: Date = new Date()): Promise<void> {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true, firstName: true, isDemo: true, sandboxId: true } });
  if (!user || user.role === "OPERATEUR" || !realAccount(user)) {
    await logAudit({ action: "auth.password_reset_requested", entityType: "User", entityId: null, metadata: { envoye: false } });
    return;
  }
  const token = await issueAccountToken(user.id, "MOT_DE_PASSE", now);
  await sendMail(passwordResetEmail(email, user.firstName, resetLink(token)));
  await logAudit({ actor: { id: user.id, role: user.role }, action: "auth.password_reset_requested", entityType: "User", entityId: user.id, metadata: { envoye: true } });
}

/** Le lien « nouveau mot de passe » est-il encore valable ? (affichage de la page, sans le consommer). */
export async function resetTokenValid(token: string, now: Date = new Date()): Promise<boolean> {
  return (await peekAccountToken(token, "MOT_DE_PASSE", now)).ok;
}

export type ResetResult = { ok: true } | { ok: false; reason: "LIEN" | "MOT_DE_PASSE"; message: string };

/**
 * L3 : nouveau mot de passe par lien. Effets, en UNE transaction :
 * nouveau hash, `sessionVersion` + 1 (toutes les sessions web et app fermées), jetons de l'app révoqués,
 * e-mail confirmé (le lien prouve l'accès à la boîte), audit. Puis un e-mail « mot de passe changé ».
 */
export async function resetPassword(token: string, newPassword: string, now: Date = new Date()): Promise<ResetResult> {
  const peek = await peekAccountToken(token, "MOT_DE_PASSE", now);
  if (!peek.ok) return { ok: false, reason: "LIEN", message: "Ce lien ne marche plus. Demandez un nouveau lien." };
  const target = await db.user.findUnique({ where: { id: peek.userId }, select: { email: true, firstName: true, lastName: true } });
  if (!target) return { ok: false, reason: "LIEN", message: "Ce lien ne marche plus. Demandez un nouveau lien." };
  const problem = passwordProblem(newPassword, target);
  if (problem) return { ok: false, reason: "MOT_DE_PASSE", message: problem };
  const passwordHash = await hashPassword(newPassword);

  const user = await db.$transaction(async (tx) => {
    const check = await consumeAccountToken(token, "MOT_DE_PASSE", now, tx);
    if (!check.ok) return null;
    const u = await tx.user.findUnique({ where: { id: check.userId }, select: { id: true, role: true, email: true, firstName: true, emailVerifiedAt: true } });
    if (!u) return null;
    await tx.user.update({
      where: { id: u.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        ...(u.emailVerifiedAt ? {} : { emailVerifiedAt: now, emailVerifiedVia: "LIEN" }),
      },
    });
    await tx.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now, revokedReason: "MOT_DE_PASSE" } });
    // Les autres liens « mot de passe » encore valables meurent aussi.
    await tx.accountToken.updateMany({ where: { userId: u.id, purpose: "MOT_DE_PASSE", usedAt: null }, data: { usedAt: now } });
    await logAudit({ actor: { id: u.id, role: u.role }, action: "auth.password_reset", entityType: "User", entityId: u.id }, tx);
    return u;
  });
  if (!user) return { ok: false, reason: "LIEN", message: "Ce lien ne marche plus. Demandez un nouveau lien." };
  await sendMail(passwordChangedEmail(user.email, user.firstName, `${appUrl()}/mot-de-passe-oublie`));
  return { ok: true };
}

/**
 * L3 / J31 : validation MANUELLE de l'e-mail par un opérateur, seulement après un appel au numéro du compte.
 * Journal : qui (opérateur), quand, comment (APPEL).
 */
export async function operatorVerifyEmail(operator: { id: string; role: Role }, userId: string, now: Date = new Date()): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, emailVerifiedAt: true, role: true, isDemo: true, sandboxId: true } });
  if (!user || user.emailVerifiedAt || !realAccount(user)) return false;
  const res = await db.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: now, emailVerifiedVia: "OPERATEUR" } });
  if (res.count !== 1) return false;
  await logAudit({ actor: operator, action: "auth.email_verified_manual", entityType: "User", entityId: user.id, metadata: { methode: "APPEL" } });
  return true;
}
