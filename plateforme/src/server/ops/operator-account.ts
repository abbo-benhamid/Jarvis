/**
 * Création d'un compte OPÉRATEUR réel (D1). Sans `server-only` : utilisé par
 * `pnpm ops:create-operator` (script) et par le seed local.
 * Un opérateur réel n'est jamais un compte démo ni un compte de bac à sable.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export type OperatorInput = { email: string; firstName: string; lastName: string; password?: string };

/** Mot de passe aléatoire lisible (24 caractères, alphabet sans ambiguïté). */
export function generatePassword(length = 24): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function validateOperatorInput(input: OperatorInput): string[] {
  const errors: string[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push("Email invalide.");
  if (!input.firstName.trim()) errors.push("Prénom obligatoire.");
  if (!input.lastName.trim()) errors.push("Nom obligatoire.");
  if (input.password !== undefined && input.password.length < 12) errors.push("Mot de passe : 12 caractères minimum.");
  return errors;
}

/**
 * Crée l'opérateur, ou remet à jour son mot de passe s'il existe déjà (même email, rôle OPERATEUR).
 * Retourne le mot de passe en clair UNE fois (à transmettre par un canal sûr).
 */
export async function upsertOperatorAccount(prisma: PrismaClient, input: OperatorInput) {
  const errors = validateOperatorInput(input);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const email = input.email.trim().toLowerCase();
  const password = input.password ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing && existing.role !== "OPERATEUR") {
    throw new Error("Un compte non opérateur utilise déjà cet email.");
  }
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: "OPERATEUR", firstName: input.firstName.trim(), lastName: input.lastName.trim(), isDemo: false },
    update: { passwordHash, isDemo: false, sandboxId: null },
    select: { id: true, email: true },
  });
  await prisma.auditLog.create({
    data: { actorId: null, action: existing ? "operator.password_reset" : "operator.created", entityType: "User", entityId: user.id },
  });
  return { ...user, password, created: !existing };
}
