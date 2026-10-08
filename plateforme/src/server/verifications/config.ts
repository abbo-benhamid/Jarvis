/**
 * L2 : choix des adaptateurs de la vérification et contrôle des clés. Fichier PUR (sans `server-only`, sans base) :
 * lu par `config-check.ts` (/api/sante), par les services et par les tests.
 *
 * | Port                       | Variable              | Valeurs                                    | Défaut  |
 * |----------------------------|-----------------------|--------------------------------------------|---------|
 * | SmsOtpPort (SMS)           | `ADAPTER_OTP`         | simule, brevo                              | simule  |
 * | SmsOtpPort (appel vocal)   | `ADAPTER_OTP_APPEL`   | simule, twilio                             | simule  |
 * | IdentityVerificationPort   | `ADAPTER_IDENTITY`    | simule, veriff, stripe                     | simule  |
 * | CompanyRegistryPort        | `ADAPTER_SIRENE`      | simule, recherche-entreprises, insee       | simule  |
 * | DocumentStoragePort        | `ADAPTER_DOCUMENTS`   | simule, base-chiffree                      | simule  |
 *
 * RÈGLE (lancement) : un adaptateur SIMULÉ est FERMÉ en mode lancement. Il ne donne jamais `VALIDE`.
 * Repli humain : l'opérateur valide après un appel ou une visio (méthode MANUEL ou VISIO).
 * RÈGLE (préinscription) : une clé absente donne un AVERTISSEMENT dans /api/sante, jamais une page 503.
 */
import { isLaunchMode, isStrictProduction, realDataAllowedFrom } from "../config-check";
import { decodeBase64Any, weakKeyBytes } from "../presence/config";

type Env = Record<string, string | undefined>;

export type SmsAdapterName = "simule" | "brevo";
export type VoiceAdapterName = "simule" | "twilio";
export type IdentityAdapterName = "simule" | "veriff" | "stripe";
export type RegistryAdapterName = "simule" | "recherche-entreprises" | "insee";
export type DocumentsAdapterName = "simule" | "base-chiffree";

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const v = value?.trim().toLowerCase();
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

const has = (env: Env, ...names: string[]) => names.every((n) => Boolean(env[n]?.trim()));

export function smsAdapterName(env: Env = process.env): SmsAdapterName {
  return pick(env.ADAPTER_OTP, ["simule", "brevo"] as const, "simule");
}
export function voiceAdapterName(env: Env = process.env): VoiceAdapterName {
  return pick(env.ADAPTER_OTP_APPEL, ["simule", "twilio"] as const, "simule");
}
export function identityAdapterName(env: Env = process.env): IdentityAdapterName {
  return pick(env.ADAPTER_IDENTITY, ["simule", "veriff", "stripe"] as const, "simule");
}
export function registryAdapterName(env: Env = process.env): RegistryAdapterName {
  return pick(env.ADAPTER_SIRENE, ["simule", "recherche-entreprises", "insee"] as const, "simule");
}
export function documentsAdapterName(env: Env = process.env): DocumentsAdapterName {
  return pick(env.ADAPTER_DOCUMENTS, ["simule", "base-chiffree"] as const, "simule");
}

/** Clés exigées par chaque adaptateur réel. */
export const REQUIRED_KEYS = {
  brevo: ["BREVO_API_KEY", "BREVO_SMS_SENDER"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
  veriff: ["VERIFF_API_KEY", "VERIFF_SHARED_SECRET"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_IDENTITY_WEBHOOK_SECRET"],
  insee: ["INSEE_API_KEY"],
  "base-chiffree": ["DOCUMENT_ENC_KEY"],
} as const;

/** `DOCUMENT_ENC_KEY` : 32 octets aléatoires en base64. Null si absente, mal formée ou trop régulière. */
export function parseDocumentKey(value: string | undefined): Uint8Array | null {
  const v = value?.trim();
  if (!v) return null;
  const k = decodeBase64Any(v);
  if (!k || k.length !== 32 || weakKeyBytes(k)) return null;
  return k;
}

/** Disponibilité réelle d'un service (adaptateur choisi + clés + mode). */
export function smsAvailable(env: Env = process.env): boolean {
  return smsAdapterName(env) === "brevo" ? has(env, ...REQUIRED_KEYS.brevo) : !isLaunchMode(env);
}
export function voiceAvailable(env: Env = process.env): boolean {
  return voiceAdapterName(env) === "twilio" ? has(env, ...REQUIRED_KEYS.twilio) : !isLaunchMode(env);
}
export function identityAvailable(env: Env = process.env): boolean {
  const a = identityAdapterName(env);
  if (a === "simule") return !isLaunchMode(env);
  return has(env, ...REQUIRED_KEYS[a]);
}
/** Registre : l'API Recherche d'entreprises n'a pas de clé. Simulé en lancement : « registre muet » (document demandé). */
export function registryAvailable(env: Env = process.env): boolean {
  return registryAdapterName(env) === "simule" ? !isLaunchMode(env) : true;
}
export function documentsAvailable(env: Env = process.env): boolean {
  return documentsAdapterName(env) === "base-chiffree" ? parseDocumentKey(env.DOCUMENT_ENC_KEY) !== null : !isLaunchMode(env);
}

/** `COMPANY_DOC_REQUIRED` : si_doute (défaut) ou toujours. */
export function companyDocAlways(env: Env = process.env): boolean {
  return env.COMPANY_DOC_REQUIRED?.trim().toLowerCase() === "toujours";
}

/** `ADDRESS_PROOF_REQUIRED` : vrai par défaut ; « false » seulement après l'avis de l'avocat (étude § 4.2). */
export function addressProofRequired(env: Env = process.env): boolean {
  return env.ADDRESS_PROOF_REQUIRED?.trim().toLowerCase() !== "false";
}

/** Plafond quotidien des SMS et appels (centimes). Défaut 1 000 (10 €). */
export function smsDailyBudgetCents(env: Env = process.env): number {
  const n = Number(env.SMS_DAILY_BUDGET_CENTS ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1_000;
}

/** L2b (m2) : plafond quotidien PAR COMPTE (centimes). Défaut 60 (environ 8 SMS). */
export function smsAccountDailyBudgetCents(env: Env = process.env): number {
  const n = Number(env.SMS_ACCOUNT_DAILY_BUDGET_CENTS ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

/**
 * L2b (M6) : un adaptateur réel qui crée des empreintes ou touche des données de la pièce est actif
 * (code SMS, appel vocal, identité, documents). Le registre (sans secret ni empreinte) n'en fait pas partie.
 */
export function realVerificationAdapterActive(env: Env = process.env): boolean {
  return smsAdapterName(env) !== "simule" || voiceAdapterName(env) !== "simule" || identityAdapterName(env) !== "simule" || documentsAdapterName(env) !== "simule";
}

/** L2b (M6) : la clé HMAC dédiée est exigée (aucun repli) en lancement, en production stricte ou avec un adaptateur réel. */
export function hmacKeyRequired(env: Env = process.env): boolean {
  return isLaunchMode(env) || isStrictProduction(env) || realVerificationAdapterActive(env);
}

/** L2b (M6) : problème de `VERIFICATION_HMAC_KEY` (null si correcte). Jamais la valeur. */
export function hmacKeyProblem(env: Env = process.env): string | null {
  const k = env.VERIFICATION_HMAC_KEY?.trim();
  if (!k) return "VERIFICATION_HMAC_KEY manquante (empreintes des numéros, des pièces et des codes). Générez-la : openssl rand -base64 32";
  if (k.length < 32) return "VERIFICATION_HMAC_KEY trop courte (32 caractères minimum). Générez-la : openssl rand -base64 32";
  if (new Set(k).size < 12) return "VERIFICATION_HMAC_KEY n'est pas assez aléatoire. Générez-la : openssl rand -base64 32";
  for (const other of ["SESSION_SECRET", "CRON_SECRET", "DOCUMENT_ENC_KEY", "ADDRESS_ENC_KEY"]) {
    if (env[other]?.trim() === k) return `VERIFICATION_HMAC_KEY doit être différente de ${other}.`;
  }
  if (env.VERIFICATION_HMAC_KEY_VERSION?.trim() && !/^[1-9]\d{0,2}$/.test(env.VERIFICATION_HMAC_KEY_VERSION.trim())) return "VERIFICATION_HMAC_KEY_VERSION doit être un entier de 1 à 999.";
  return null;
}

/**
 * L2b (M6) : problème BLOQUANT (page 503) dès qu'un adaptateur réel est actif ou que les données réelles sont ouvertes.
 * Appelé aussi hors production stricte (préversion, Clever Cloud).
 */
export function verificationHmacProblems(env: Env = process.env): string[] {
  if (!realVerificationAdapterActive(env) && !(isLaunchMode(env) && realDataAllowedFrom(env))) return [];
  const p = hmacKeyProblem(env);
  return p ? [p] : [];
}

/** Secret de la page d'identité simulée (essai seulement). Clé de développement publique si absente. */
export const DEV_SIMULATED_WEBHOOK_SECRET = "koudmen-dev-identite-simulee-ne-pas-utiliser-en-production";
export function simulatedWebhookSecret(env: Env = process.env): string {
  return env.SIMULATED_WEBHOOK_SECRET?.trim() || DEV_SIMULATED_WEBHOOK_SECRET;
}

const NAMES: Record<string, string> = {
  ADAPTER_OTP: "Code SMS",
  ADAPTER_OTP_APPEL: "Code par appel vocal",
  ADAPTER_IDENTITY: "Vérification d'identité",
  ADAPTER_SIRENE: "Registre des entreprises",
  ADAPTER_DOCUMENTS: "Dépôt de documents",
};

/**
 * Avertissements de /api/sante (jamais une page 503). Jamais la valeur d'une clé.
 * - Un service réel est demandé sans ses clés : le service est fermé.
 * - Un service est simulé en lancement : il est fermé ; repli humain.
 */
export function verificationConfigWarnings(env: Env = process.env): string[] {
  const out: string[] = [];
  const launch = isLaunchMode(env);
  const missing = (adapter: keyof typeof REQUIRED_KEYS) => REQUIRED_KEYS[adapter].filter((k) => !env[k]?.trim());
  const realWithoutKeys = (variable: string, adapter: keyof typeof REQUIRED_KEYS) => {
    const m = missing(adapter);
    if (m.length > 0) out.push(`${variable}=${adapter} sans ${m.join(", ")} : ${NAMES[variable]} fermé. Repli : appel ou visio de l'équipe.`);
  };
  const sms = smsAdapterName(env);
  if (sms === "brevo") realWithoutKeys("ADAPTER_OTP", "brevo");
  else if (launch) out.push("ADAPTER_OTP=simule en lancement : le code SMS est fermé. L'équipe vérifie le numéro pendant son appel.");
  const voice = voiceAdapterName(env);
  if (voice === "twilio") realWithoutKeys("ADAPTER_OTP_APPEL", "twilio");
  else if (launch) out.push("ADAPTER_OTP_APPEL=simule en lancement : le code par appel vocal est fermé.");
  const id = identityAdapterName(env);
  if (id !== "simule") realWithoutKeys("ADAPTER_IDENTITY", id);
  else if (launch) out.push("ADAPTER_IDENTITY=simule en lancement : la vérification d'identité automatique est fermée. Repli : visio de l'équipe.");
  const reg = registryAdapterName(env);
  if (reg === "insee" && missing("insee").length > 0) out.push("ADAPTER_SIRENE=insee sans INSEE_API_KEY : seule l'API Recherche d'entreprises répond.");
  else if (reg === "simule" && launch) out.push("ADAPTER_SIRENE=simule en lancement : le registre ne répond pas ; un document d'entreprise est demandé.");
  const docs = documentsAdapterName(env);
  if (docs === "base-chiffree") {
    if (!env.DOCUMENT_ENC_KEY?.trim()) out.push("ADAPTER_DOCUMENTS=base-chiffree sans DOCUMENT_ENC_KEY : le dépôt de documents est fermé. Générez la clé : openssl rand -base64 32");
    else if (!parseDocumentKey(env.DOCUMENT_ENC_KEY)) out.push("DOCUMENT_ENC_KEY n'a pas la bonne forme (32 octets aléatoires en base64) : le dépôt de documents est fermé.");
  } else if (launch) out.push("ADAPTER_DOCUMENTS=simule en lancement : le dépôt de documents est fermé. Repli : document montré en visio.");
  if (env.DOCUMENT_ENC_KEY?.trim() && env.DOCUMENT_ENC_KEY.trim() === env.ADDRESS_ENC_KEY?.trim()) out.push("DOCUMENT_ENC_KEY doit être différente de ADDRESS_ENC_KEY.");
  if (env.SMS_DAILY_BUDGET_CENTS?.trim() && !(Number(env.SMS_DAILY_BUDGET_CENTS) > 0)) out.push("SMS_DAILY_BUDGET_CENTS n'est pas un nombre positif : le plafond par défaut (10 €) s'applique.");
  // L2b (M6) : en lancement sans adaptateur réel (préinscription), la clé n'est pas bloquante ; sans elle,
  // la validation manuelle du téléphone par l'opérateur est fermée.
  if (launch && verificationHmacProblems(env).length === 0) {
    const p = hmacKeyProblem(env);
    if (p) out.push(`${p} En attendant, l'opérateur ne peut pas valider un numéro.`);
  }
  return out;
}

/**
 * Problèmes BLOQUANTS (page 503) : seulement avec les données réelles ouvertes. En préinscription : jamais.
 * Une clé de documents PRÉSENTE mais fausse ou égale à la clé d'adresse est alors refusée.
 */
export function verificationConfigProblems(env: Env = process.env): string[] {
  const out: string[] = [...verificationHmacProblems(env)];
  if (!isLaunchMode(env) || !realDataAllowedFrom(env)) return out;
  const key = env.DOCUMENT_ENC_KEY?.trim();
  if (key && !parseDocumentKey(key)) out.push("DOCUMENT_ENC_KEY n'a pas la bonne forme (32 octets aléatoires en base64). Générez-la : openssl rand -base64 32");
  if (key && key === env.ADDRESS_ENC_KEY?.trim()) out.push("DOCUMENT_ENC_KEY doit être différente de ADDRESS_ENC_KEY.");
  return out;
}

/** /api/sante : état de chaque service (aucune valeur secrète). */
export function verificationServicesState(env: Env = process.env) {
  return {
    sms: { adaptateur: smsAdapterName(env), ouvert: smsAvailable(env) },
    appel: { adaptateur: voiceAdapterName(env), ouvert: voiceAvailable(env) },
    identite: { adaptateur: identityAdapterName(env), ouvert: identityAvailable(env) },
    registre: { adaptateur: registryAdapterName(env), ouvert: registryAvailable(env) },
    documents: { adaptateur: documentsAdapterName(env), ouvert: documentsAvailable(env) },
  };
}
