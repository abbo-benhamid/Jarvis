/**
 * Contrôle de la configuration de PRODUCTION (B1, B3). Fonctions PURES (sans `server-only`) :
 * utilisées par `src/instrumentation.ts` (au démarrage), par `src/server/env.ts` (à chaque lecture)
 * et par les tests.
 *
 * Règle : en production, l'application REFUSE de démarrer si un secret ou un code testeur
 * est une valeur d'exemple (dépôt public), une valeur de CI, ou une valeur trop courte.
 */

type Env = Record<string, string | undefined>;

/**
 * Production « stricte » : déploiement Vercel de production, ou KOUDMEN_STRICT_CONFIG="true".
 * `next start` en local et en CI (NODE_ENV=production) n'est PAS strict : les e2e utilisent des valeurs factices.
 */
export function isStrictProduction(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.KOUDMEN_STRICT_CONFIG === "true";
}

/** Longueur minimale des secrets en production (openssl rand -base64 48 donne 64 caractères). */
export const MIN_SECRET_LENGTH = 32;
/** Longueur minimale d'un code testeur en production (ex. T-7K4Q-9XWM-3HPA). */
export const MIN_TESTER_CODE_LENGTH = 12;
/** Nombre minimal de caractères aléatoires (lettres et chiffres) dans un code testeur. */
export const MIN_TESTER_CODE_RANDOM = 8;

/** Marqueurs des valeurs d'exemple ou de CI. Une valeur qui en contient un est refusée en production. */
const PLACEHOLDER_MARKERS = [
  "remplacez",
  "remplacer",
  "choisissez",
  "exemple",
  "example",
  "changeme",
  "change-me",
  "placeholder",
  "factice",
  "ci-secret",
  "ci-cron",
  "pour-les-tests",
  "demo-koudmen",
];
/** Marqueurs en plus pour les codes testeurs (trop courts pour un secret aléatoire : risque de faux positif). */
const CODE_MARKERS = ["e2e", "a-remplacer"];

/** Anciens codes publiés dans le dépôt public (S1b). Jamais acceptés en production. */
export const PUBLIC_TESTER_CODES = ["NADIA-07", "DIASPORA-01", "LOCAL-01", "ACCOMP-01", "E2E-TEST"];

export function looksLikePlaceholder(value: string, extra: readonly string[] = []): boolean {
  const v = value.toLowerCase();
  return [...PLACEHOLDER_MARKERS, ...extra].some((m) => v.includes(m));
}

/** Problème d'un secret (null si correct). */
export function secretProblem(name: string, value: string | undefined): string | null {
  if (!value) return `${name} manquant.`;
  if (value.length < MIN_SECRET_LENGTH) return `${name} trop court (${MIN_SECRET_LENGTH} caractères minimum).`;
  if (looksLikePlaceholder(value)) return `${name} est une valeur d'exemple. Générez-le avec : openssl rand -base64 48`;
  // Entropie grossière : une valeur répétitive (« aaaa… », « 0123… » répété) est refusée.
  if (new Set(value).size < 12) return `${name} n'est pas assez aléatoire. Générez-le avec : openssl rand -base64 48`;
  return null;
}

/** Normalise un code testeur : majuscules, sans espaces. */
export function normalizeTesterCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function parseTesterCodes(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map(normalizeTesterCode)
    .filter((c) => c.length > 0);
}

/** Problème d'un code testeur en production (null si correct). */
export function testerCodeProblem(code: string): string | null {
  if (PUBLIC_TESTER_CODES.includes(code)) return `le code ${code} est public (ancien exemple du dépôt)`;
  if (looksLikePlaceholder(code, CODE_MARKERS)) return `le code ${code.slice(0, 4)}… est une valeur d'exemple`;
  if (code.length < MIN_TESTER_CODE_LENGTH) return `un code fait moins de ${MIN_TESTER_CODE_LENGTH} caractères`;
  if (code.replace(/[^A-Z0-9]/g, "").length < MIN_TESTER_CODE_RANDOM) return "un code a trop peu de lettres et de chiffres";
  return null;
}

/**
 * Liste des problèmes de configuration en production stricte. Vide = configuration acceptée.
 * Les messages ne contiennent jamais la valeur d'un secret.
 */
export function productionConfigProblems(env: Env = process.env): string[] {
  if (!isStrictProduction(env)) return [];
  const out: string[] = [];
  for (const name of ["SESSION_SECRET", "CRON_SECRET"]) {
    const p = secretProblem(name, env[name]);
    if (p) out.push(p);
  }
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.CRON_SECRET) out.push("SESSION_SECRET et CRON_SECRET doivent être différents.");
  const codes = parseTesterCodes(env.TESTER_INVITE_CODES);
  if (codes.length === 0) out.push("TESTER_INVITE_CODES est vide.");
  for (const c of codes) {
    const p = testerCodeProblem(c);
    if (p) out.push(`TESTER_INVITE_CODES : ${p}. Générez des codes avec : pnpm ops:generate-codes`);
  }
  if (env.RATE_LIMIT_DISABLED === "true") out.push("RATE_LIMIT_DISABLED est interdit en production.");
  if (env.TEST_END_DATE && Number.isNaN(Date.parse(env.TEST_END_DATE))) out.push("TEST_END_DATE n'est pas une date (format AAAA-MM-JJ).");
  return out;
}

/** Lève une erreur si la configuration de production est refusée. */
export function assertProductionConfig(env: Env = process.env): void {
  const problems = productionConfigProblems(env);
  if (problems.length > 0) {
    throw new Error(`Configuration de production refusée :\n- ${problems.join("\n- ")}`);
  }
}
