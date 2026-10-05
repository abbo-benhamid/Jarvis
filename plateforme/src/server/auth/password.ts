import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Empreinte factice (même coût) : calculée une fois, jamais égale à un vrai mot de passe. */
let dummyHash: string | null = null;

/**
 * Sécurité m1 : compte INCONNU → même calcul bcrypt qu'un compte connu. Le temps de réponse
 * ne révèle plus si un email a un compte. Retourne toujours false.
 */
export async function verifyPasswordForUnknownAccount(plain: string): Promise<false> {
  dummyHash ??= await bcrypt.hash(`compte-inconnu-${Math.random()}`, ROUNDS);
  await bcrypt.compare(plain, dummyHash);
  return false;
}
