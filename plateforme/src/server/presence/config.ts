/**
 * L1-B : clés de la présence (QR signé de la carte domicile, chiffrement de l'adresse).
 * Fichier PUR (sans `server-only`, sans base) : lu par `config-check.ts` (démarrage), par les services et par les tests.
 *
 * | Variable           | Contenu                                                              | Production stricte        |
 * |--------------------|----------------------------------------------------------------------|---------------------------|
 * | `QR_SIGNING_KEY`   | Graine Ed25519 de 32 octets en base64/base64url, ou clé PKCS#8 PEM   | Obligatoire, jamais d'exemple |
 * | `ADDRESS_ENC_KEY`  | 32 octets aléatoires en base64/base64url (AES-256-GCM)               | Obligatoire, jamais d'exemple |
 *
 * L1d (D2) : les clés sont EXIGÉES seulement quand les données réelles des aînés sont ouvertes
 * (`realDataAllowed()` vrai en mode lancement). En préinscription, leur absence ne bloque pas le site (pas de page 503).
 * Contrôles actifs en production stricte ET dès que `NODE_ENV=production` avec les données réelles ouvertes
 * (Preview Vercel, Clever Cloud HDS…) : clé de développement du dépôt refusée, forme, longueur et entropie vérifiées.
 * Ailleurs (développement, tests, e2e en mode essai), la clé de DÉVELOPPEMENT fixe (publique) sert si la variable est absente.
 */
import { isLaunchMode, realDataAllowedFrom } from "../config-check";

type Env = Record<string, string | undefined>;

/** Graine Ed25519 de développement (publique : refusée en production stricte). */
export const DEV_QR_SEED_HEX = "6b6f75646d656e2d6465762d71722d7369676e696e672d6b65792d6e6f2d70726f64".slice(0, 64);
/** Clé AES de développement (publique : refusée en production stricte). */
export const DEV_ADDRESS_KEY_HEX = "6b6f75646d656e2d6465762d616464726573732d6b65792d6e6f2d70726f642121".slice(0, 64);

/** Marqueurs d'une valeur d'exemple (même liste d'esprit que config-check). */
const PLACEHOLDER = ["remplacez", "remplacer", "choisissez", "exemple", "example", "changeme", "placeholder", "factice"];

function isStrict(env: Env): boolean {
  return env.VERCEL_ENV === "production" || env.KOUDMEN_STRICT_CONFIG === "true";
}

/**
 * D2 : les deux clés sont OBLIGATOIRES (jamais de repli sur la clé de développement) quand les données réelles
 * sont ouvertes (mode lancement + `realDataAllowed()`) sur un serveur de production : production stricte,
 * ou `NODE_ENV=production` (Preview Vercel, `next start` sur Clever Cloud).
 */
export function presenceKeysRequired(env: Env = process.env): boolean {
  return isLaunchMode(env) && realDataAllowedFrom(env) && (isStrict(env) || env.NODE_ENV === "production");
}

/** D2 : contrôles de forme et d'entropie actifs (production stricte, ou clés exigées). */
function keyChecksActive(env: Env): boolean {
  return isStrict(env) || presenceKeysRequired(env);
}

/** D2 : nombre minimal d'octets DIFFÉRENTS dans une clé de 32 octets (une clé aléatoire en a environ 30). */
export const MIN_DISTINCT_KEY_BYTES = 16;

/** D2 : une clé de 32 octets trop régulière (octets nuls, motif répété) est refusée. */
export function weakKeyBytes(bytes: Uint8Array): boolean {
  return new Set(bytes).size < MIN_DISTINCT_KEY_BYTES;
}

/** base64 ou base64url → octets (null si la forme est fausse). */
export function decodeBase64Any(value: string): Uint8Array | null {
  let v = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return null;
  v = v.replace(/=+$/, "");
  v += "=".repeat((4 - (v.length % 4)) % 4);
  try {
    // atob : disponible dans Node et dans le runtime Edge (middleware), contrairement à Buffer.
    const bin = atob(v);
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

export type QrKeySource = { kind: "seed"; seed: Uint8Array } | { kind: "pem"; pem: string };

/** Lit QR_SIGNING_KEY. Null si absente ou mal formée. */
export function parseQrSigningKey(value: string | undefined): QrKeySource | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.startsWith("-----BEGIN")) return v.includes("PRIVATE KEY") ? { kind: "pem", pem: v.replace(/\\n/g, "\n") } : null;
  const seed = decodeBase64Any(v);
  return seed && seed.length === 32 ? { kind: "seed", seed } : null;
}

/** Lit ADDRESS_ENC_KEY (32 octets). Null si absente ou mal formée. */
export function parseAddressKey(value: string | undefined): Uint8Array | null {
  const v = value?.trim();
  if (!v) return null;
  const k = decodeBase64Any(v);
  return k && k.length === 32 ? k : null;
}

const GENERATE = "Générez-la : openssl rand -base64 32";

/**
 * Problèmes de configuration des clés L1-B (vide quand les contrôles ne s'appliquent pas). Jamais la valeur d'une clé.
 * D2 : une clé ABSENTE est un problème seulement si les données réelles sont ouvertes (`presenceKeysRequired`).
 * Une clé PRÉSENTE est toujours contrôlée (exemple, forme, clé de développement, entropie).
 */
export function presenceConfigProblems(env: Env = process.env): string[] {
  if (!keyChecksActive(env)) return [];
  const required = presenceKeysRequired(env);
  const out: string[] = [];
  const qr = env.QR_SIGNING_KEY?.trim();
  const qrKey = parseQrSigningKey(qr);
  if (!qr) {
    if (required) out.push(`QR_SIGNING_KEY manquant (clé de signature des cartes domicile, obligatoire avec les données réelles). ${GENERATE}`);
  } else if (PLACEHOLDER.some((m) => qr.toLowerCase().includes(m))) out.push(`QR_SIGNING_KEY est une valeur d'exemple. ${GENERATE}`);
  else if (!qrKey) out.push("QR_SIGNING_KEY n'a pas la bonne forme (32 octets en base64, ou clé PKCS#8 PEM).");
  else if (qrKey.kind === "seed" && toHex(qrKey.seed) === DEV_QR_SEED_HEX) out.push(`QR_SIGNING_KEY est la clé de développement. ${GENERATE}`);
  else if (qrKey.kind === "seed" && weakKeyBytes(qrKey.seed)) out.push(`QR_SIGNING_KEY n'est pas assez aléatoire. ${GENERATE}`);

  const ad = env.ADDRESS_ENC_KEY?.trim();
  const adKey = parseAddressKey(ad);
  if (!ad) {
    if (required) out.push(`ADDRESS_ENC_KEY manquant (chiffrement de l'adresse des aînés, obligatoire avec les données réelles). ${GENERATE}`);
  } else if (PLACEHOLDER.some((m) => ad.toLowerCase().includes(m))) out.push(`ADDRESS_ENC_KEY est une valeur d'exemple. ${GENERATE}`);
  else if (!adKey) out.push("ADDRESS_ENC_KEY n'a pas la bonne forme (32 octets en base64).");
  else if (toHex(adKey) === DEV_ADDRESS_KEY_HEX) out.push(`ADDRESS_ENC_KEY est la clé de développement. ${GENERATE}`);
  else if (weakKeyBytes(adKey)) out.push(`ADDRESS_ENC_KEY n'est pas assez aléatoire. ${GENERATE}`);
  if (qr && ad && qr === ad) out.push("QR_SIGNING_KEY et ADDRESS_ENC_KEY doivent être différentes.");
  return out;
}

/**
 * Clé QR utilisée : celle de l'environnement, sinon la clé de développement.
 * D2 : jamais de repli en production stricte, ni quand les données réelles sont ouvertes avec NODE_ENV=production ;
 * dans ce dernier cas, la clé de développement et une clé faible sont refusées aussi.
 */
export function resolveQrKey(env: Env = process.env): QrKeySource {
  const k = parseQrSigningKey(env.QR_SIGNING_KEY);
  if (k) {
    if (presenceKeysRequired(env) && k.kind === "seed" && (toHex(k.seed) === DEV_QR_SEED_HEX || weakKeyBytes(k.seed))) {
      throw new Error("QR_SIGNING_KEY refusée : clé de développement ou trop faible.");
    }
    return k;
  }
  if (keyChecksActive(env)) throw new Error("QR_SIGNING_KEY manquant ou mal formé.");
  return { kind: "seed", seed: fromHex(DEV_QR_SEED_HEX) };
}

/**
 * Clé AES utilisée : celle de l'environnement, sinon la clé de développement.
 * D2 : mêmes règles que `resolveQrKey()`.
 */
export function resolveAddressKey(env: Env = process.env): Uint8Array {
  const k = parseAddressKey(env.ADDRESS_ENC_KEY);
  if (k) {
    if (presenceKeysRequired(env) && (toHex(k) === DEV_ADDRESS_KEY_HEX || weakKeyBytes(k))) {
      throw new Error("ADDRESS_ENC_KEY refusée : clé de développement ou trop faible.");
    }
    return k;
  }
  if (keyChecksActive(env)) throw new Error("ADDRESS_ENC_KEY manquant ou mal formé.");
  return fromHex(DEV_ADDRESS_KEY_HEX);
}
