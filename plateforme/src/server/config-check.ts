/**
 * Contrôle de la configuration de PRODUCTION (B1, B3). Fonctions PURES (sans `server-only`) :
 * utilisées par `src/instrumentation.ts` (au démarrage), par `src/server/env.ts` (à chaque lecture)
 * et par les tests.
 *
 * Règle : en production, l'application REFUSE de démarrer si un secret ou un code testeur
 * est une valeur d'exemple (dépôt public), une valeur de CI, ou une valeur trop courte.
 */

import { presenceConfigProblems } from "./presence/config";
import { verificationConfigProblems, verificationConfigWarnings, verificationHmacProblems } from "./verifications/config";

type Env = Record<string, string | undefined>;

/**
 * Production « stricte » : déploiement Vercel de production, ou KOUDMEN_STRICT_CONFIG="true".
 * `next start` en local et en CI (NODE_ENV=production) n'est PAS strict : les e2e utilisent des valeurs factices.
 */
export function isStrictProduction(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.KOUDMEN_STRICT_CONFIG === "true";
}

// ─────────────── L1 : mode du site et données réelles ───────────────

/** Mode du site (L1). « lancement » : site réel, sans démo. « essai » : démo, bac à sable, robots (développement, tests). */
export type SiteMode = "lancement" | "essai";

/**
 * L1 : UNE seule règle décide du mode. `KOUDMEN_MODE` (lancement | essai) gagne.
 * Sans valeur : « lancement » en production (Vercel production ou NODE_ENV=production), « essai » sinon.
 */
export function siteMode(env: Env = process.env): SiteMode {
  const v = env.KOUDMEN_MODE?.trim().toLowerCase();
  if (v === "lancement" || v === "essai") return v;
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production" ? "lancement" : "essai";
}

export function isLaunchMode(env: Env = process.env): boolean {
  return siteMode(env) === "lancement";
}

/**
 * L1 : pages du mode essai (démo, bac à sable, offre factice, mesure du test) et leur page de remplacement
 * en mode lancement (redirection du middleware). Les pages appellent AUSSI `requireTrialMode()` (404).
 */
const TRIAL_ONLY: [prefix: string, target: string][] = [
  ["/tester", "/inscription"],
  ["/cgu-test", "/cgu"],
  ["/famille/visite-decouverte", "/famille/formule"],
  ["/operateur/test", "/operateur"],
];

export function launchRedirect(pathname: string): string | null {
  for (const [prefix, target] of TRIAL_ONLY) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return target;
  }
  return null;
}

/** R1 : variables obligatoires pour autoriser les données réelles des aînés (HDS, AIPD, DPO). */
export const REAL_DATA_REQUIREMENTS = ["HEBERGEUR_HDS", "AIPD_DATE", "DPO_CONTACT"] as const;

/**
 * R1 (critique juridique J1) : données réelles des aînés (fiche, adresse, QR, Kayé, trajet).
 * - Mode essai : données d'exemple seulement → autorisé (bac à sable, développement, tests).
 * - Mode lancement : `DONNEES_REELLES_AUTORISEES="true"` ET hébergeur HDS, date d'AIPD et contact DPO renseignés.
 *   Sinon : mode PRÉINSCRIPTION (comptes ouverts, aucune donnée d'aîné).
 */
export function realDataAllowedFrom(env: Env = process.env): boolean {
  if (!isLaunchMode(env)) return true;
  if (env.DONNEES_REELLES_AUTORISEES?.trim().toLowerCase() !== "true") return false;
  return REAL_DATA_REQUIREMENTS.every((k) => Boolean(env[k]?.trim()));
}

/** R2 : identité de l'éditeur, obligatoire en production (LCEN). */
export const EDITOR_FIELDS = ["EDITEUR_NOM", "EDITEUR_ADRESSE", "EDITEUR_EMAIL", "DIRECTEUR_PUBLICATION"] as const;

/** Expéditeur des e-mails : « Nom <adresse> » ou « adresse ». Null si invalide. */
export function parseMailFrom(raw: string | undefined): { name: string; email: string } | null {
  const v = raw?.trim();
  if (!v) return null;
  const m = v.match(/^(?:"?([^"<>]*?)"?\s*<([^<>\s]+@[^<>\s]+\.[^<>\s]+)>|([^<>\s]+@[^<>\s]+\.[^<>\s]+))$/);
  if (!m) return null;
  return { name: (m[1] ?? "").trim() || "Koudmen", email: (m[2] ?? m[3])! };
}

/**
 * Avertissements (L3, L12) : la configuration est acceptée, mais un point demande une action.
 * Affichés dans /api/sante (pas de page 503). Jamais de valeur secrète.
 */
export function configWarnings(env: Env = process.env): string[] {
  const out: string[] = [];
  const launch = isLaunchMode(env);
  if (launch && !env.BREVO_API_KEY?.trim()) {
    out.push("BREVO_API_KEY absente : aucun e-mail ne part. L'opérateur valide les e-mails à la main (page Comptes).");
  }
  if (launch && env.BREVO_API_KEY?.trim() && !env.MAIL_FROM?.trim()) out.push("MAIL_FROM absente : l'expéditeur par défaut est utilisé.");
  if (launch && !realDataAllowedFrom(env)) {
    out.push("Mode préinscription : les données réelles des aînés sont fermées (hébergement HDS, AIPD et DPO manquants ou DONNEES_REELLES_AUTORISEES absente).");
  }
  if (launch && realDataAllowedFrom(env)) {
    out.push("Données réelles des aînés ouvertes : gardez à jour le contrat HDS, l'AIPD et l'avis de l'avocat.");
  }
  // D1 : en production stricte, le mode essai est un problème bloquant (productionConfigProblems), pas un avertissement.
  if (!launch && !isStrictProduction(env) && env.NODE_ENV === "production") {
    out.push("Mode essai sur un serveur de production : la démo et le bac à sable sont ouverts (données d'exemple seulement).");
  }
  // L2 : services de vérification (SMS, appel, identité, registre, documents). Avertissement, jamais de 503.
  out.push(...verificationConfigWarnings(env));
  return out;
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
  // D2 : hors production stricte, seules les clés de la présence sont contrôlées, et seulement quand
  // NODE_ENV=production ouvre les données réelles (Preview Vercel, Clever Cloud HDS). Vide sinon (local, CI, e2e).
  // L2b (M6) : clé HMAC des vérifications, dès qu'un adaptateur réel est actif (préversion comprise).
  if (!isStrictProduction(env)) return [...presenceConfigProblems(env), ...verificationHmacProblems(env)];
  const out: string[] = [];
  // L1d (D1, sécurité S1) : la démo et le bac à sable n'existent jamais en production stricte.
  // `KOUDMEN_MODE=essai` ouvrirait les données réelles sans HDS ni AIPD ; c'est un problème BLOQUANT (page 503).
  if (siteMode(env) === "essai") {
    out.push("KOUDMEN_MODE=essai est interdit en production : il ouvre la démo et les données sans HDS. Mettez KOUDMEN_MODE=lancement (ou laissez vide).");
  }
  if (env.KOUDMEN_OPERATEUR_CONFIRME?.trim().toLowerCase() === "true") {
    out.push("KOUDMEN_OPERATEUR_CONFIRME=true est interdit en production : la confirmation simulée de l'aîné n'est pas une preuve (R7).");
  }
  if (env.DEMO_MODE?.trim().toLowerCase() === "true") out.push("DEMO_MODE=true est interdit en production : mettez DEMO_MODE=false.");
  for (const name of ["SESSION_SECRET", "CRON_SECRET"]) {
    const p = secretProblem(name, env[name]);
    if (p) out.push(p);
  }
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.CRON_SECRET) out.push("SESSION_SECRET et CRON_SECRET doivent être différents.");
  const mode = env.KOUDMEN_MODE?.trim().toLowerCase();
  if (mode && mode !== "lancement" && mode !== "essai") out.push("KOUDMEN_MODE doit valoir lancement ou essai.");
  // L1 : les codes testeurs servent seulement au bac à sable (mode essai).
  if (!isLaunchMode(env)) {
    const codes = parseTesterCodes(env.TESTER_INVITE_CODES);
    if (codes.length === 0) out.push("TESTER_INVITE_CODES est vide.");
    for (const c of codes) {
      const p = testerCodeProblem(c);
      if (p) out.push(`TESTER_INVITE_CODES : ${p}. Générez des codes avec : pnpm ops:generate-codes`);
    }
  }
  // R2 : mentions légales complètes (éditeur, directeur de la publication).
  for (const name of EDITOR_FIELDS) {
    if (!env[name]?.trim()) out.push(`${name} est vide (mentions légales obligatoires).`);
  }
  // R1 : données réelles des aînés seulement avec hébergeur HDS, AIPD et DPO.
  if (env.DONNEES_REELLES_AUTORISEES?.trim().toLowerCase() === "true") {
    for (const name of REAL_DATA_REQUIREMENTS) {
      if (!env[name]?.trim()) out.push(`DONNEES_REELLES_AUTORISEES=true exige ${name}.`);
    }
  }
  if (env.MAIL_FROM?.trim() && !parseMailFrom(env.MAIL_FROM)) out.push("MAIL_FROM n'est pas une adresse valide (exemple : Koudmen <bonjour@exemple.fr>).");
  if (env.RATE_LIMIT_DISABLED === "true") out.push("RATE_LIMIT_DISABLED est interdit en production.");
  // X2 (sécurité PB1) et PM3 : push réel par Expo (États-Unis) seulement après la validation du DPO.
  if (env.ADAPTER_PUSH?.trim().toLowerCase() === "expo") {
    if (env.PUSH_DPO_VALIDE?.trim() !== "true") out.push("ADAPTER_PUSH=expo est refusé tant que le DPO n'a pas validé le push (PUSH_DPO_VALIDE=true).");
    if (!env.EXPO_ACCESS_TOKEN?.trim()) out.push("ADAPTER_PUSH=expo exige EXPO_ACCESS_TOKEN (sécurité renforcée des push Expo).");
  }
  // PM1 : seules valeurs connues pour la confiance dans le proxy.
  if (env.TRUST_PROXY && !["vercel", "clevercloud", "aucun"].includes(env.TRUST_PROXY.trim().toLowerCase())) {
    out.push("TRUST_PROXY doit valoir vercel, clevercloud ou aucun.");
  }
  if (env.TEST_END_DATE && !/^\d{4}-\d{2}-\d{2}$/.test(env.TEST_END_DATE.trim())) out.push("TEST_END_DATE n'est pas une date (format AAAA-MM-JJ).");
  // L1-B (L9, R7), L1d (D2) : clé de signature des cartes domicile et clé de chiffrement des adresses
  // (src/server/presence/config.ts) ; exigées seulement avec les données réelles ouvertes.
  out.push(...presenceConfigProblems(env));
  // L2 : seulement avec les données réelles ouvertes (jamais en préinscription) : clé de documents fausse.
  out.push(...verificationConfigProblems(env));
  return out;
}

/** Lève une erreur si la configuration de production est refusée. */
export function assertProductionConfig(env: Env = process.env): void {
  const problems = productionConfigProblems(env);
  if (problems.length > 0) {
    throw new Error(`Configuration de production refusée :\n- ${problems.join("\n- ")}`);
  }
}
