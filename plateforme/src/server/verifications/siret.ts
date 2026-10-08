/**
 * L2 (étude § 3.2) : SIRET et code APE. Fonctions PURES.
 */

/** « 732 829 320 00074 » → « 73282932000074 », ou null si la forme est fausse. */
export function normalizeSiret(raw: string): string | null {
  const v = raw.replace(/\s/g, "");
  return /^\d{14}$/.test(v) ? v : null;
}

/** Clé de Luhn (cas particulier : établissements de La Poste, SIREN 356000000, somme des chiffres multiple de 5). */
export function siretChecksumOk(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  if (siret.startsWith("356000000")) return [...siret].reduce((s, c) => s + Number(c), 0) % 5 === 0;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(siret[13 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Codes APE attendus pour les services à la personne [À VÉRIFIER liste et passage à la NAF 2025].
 * Un autre code donne une ALERTE pour l'opérateur, jamais un refus : la déclaration NOVA compte plus.
 */
export const EXPECTED_APE_CODES = ["8810A", "8810B", "8810C", "8121Z", "9609Z", "8899B"] as const;

export function normalizeApe(code: string | null | undefined): string {
  return (code ?? "").replace(/[.\s]/g, "").toUpperCase();
}

export function apeExpected(code: string | null | undefined): boolean {
  return (EXPECTED_APE_CODES as readonly string[]).includes(normalizeApe(code));
}
