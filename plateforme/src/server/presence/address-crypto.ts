/**
 * L1-B (R7) : chiffrement applicatif de l'adresse de l'aîné (AES-256-GCM, clé `ADDRESS_ENC_KEY`).
 * Format stocké : `a1:<iv base64url>:<texte chiffré + étiquette base64url>`. Données associées : « koudmen:adresse:v1 ».
 * Une fuite de la base seule ne révèle pas l'adresse. [À VÉRIFIER] rotation de clé (aujourd'hui : une clé, préfixe `a1`).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { resolveAddressKey } from "./config";

const PREFIX = "a1";
const AAD = Buffer.from("koudmen:adresse:v1");

export function encryptAddress(plain: string, key: Uint8Array = resolveAddressKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${PREFIX}:${iv.toString("base64url")}:${ct.toString("base64url")}`;
}

/** Adresse en clair, ou null si le texte est absent, mal formé ou chiffré avec une autre clé. */
export function decryptAddress(stored: string | null | undefined, key: Uint8Array = resolveAddressKey()): string | null {
  return decryptWith(stored, PREFIX, AAD, key);
}

// ─────────────── L1d (D3) : position précise du domicile ───────────────

const GEO_PREFIX = "g1";
/** Données associées distinctes de l'adresse : un texte chiffré d'adresse n'est pas lu comme une position. */
const GEO_AAD = Buffer.from("koudmen:domicile-geo:v1");

/**
 * D3 (sécurité M2) : la position PRÉCISE du domicile (géocodage) est chiffrée avec la clé de l'adresse.
 * En clair, la base garde seulement le centre de la commune. Format : `g1:<iv>:<texte chiffré + étiquette>`.
 */
export function encryptHomeGeo(point: { lat: number; lng: number }, key: Uint8Array = resolveAddressKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(GEO_AAD);
  const plain = JSON.stringify({ a: point.lat, o: point.lng });
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${GEO_PREFIX}:${iv.toString("base64url")}:${ct.toString("base64url")}`;
}

/** Position précise en clair, ou null (absente, mal formée, autre clé). */
export function decryptHomeGeo(stored: string | null | undefined, key: Uint8Array = resolveAddressKey()): { lat: number; lng: number } | null {
  const plain = decryptWith(stored, GEO_PREFIX, GEO_AAD, key);
  if (!plain) return null;
  try {
    const v = JSON.parse(plain) as { a?: unknown; o?: unknown };
    if (typeof v.a !== "number" || typeof v.o !== "number" || Math.abs(v.a) > 90 || Math.abs(v.o) > 180) return null;
    return { lat: v.a, lng: v.o };
  } catch {
    return null;
  }
}

function decryptWith(stored: string | null | undefined, expectedPrefix: string, aad: Buffer, key: Uint8Array): string | null {
  if (!stored) return null;
  const [prefix, ivB64, ctB64] = stored.split(":");
  if (prefix !== expectedPrefix || !ivB64 || !ctB64) return null;
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const data = Buffer.from(ctB64, "base64url");
    if (iv.length !== 12 || data.length < 17) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
