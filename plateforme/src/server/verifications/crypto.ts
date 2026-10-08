/**
 * L2 : empreintes HMAC et chiffrement des documents (AES-256-GCM, chiffrement par enveloppe).
 * - HMAC : clé dérivée de SESSION_SECRET (HKDF, une étiquette par usage). Le code SMS, le numéro et le numéro
 *   de pièce sont gardés en EMPREINTE, jamais en clair. [À VÉRIFIER] changer SESSION_SECRET casse la recherche
 *   des numéros déjà vérifiés : prévoir VERIFICATION_HMAC_KEY dédiée avant les données réelles.
 * - Documents : une clé AES-256-GCM PAR FICHIER, chiffrée par la clé maîtresse `DOCUMENT_ENC_KEY`.
 *   La base ne voit que du chiffré. Clé maîtresse hors base (variable d'environnement).
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { fromHex } from "../presence/config";
import { documentsAdapterName, parseDocumentKey } from "./config";

type Env = Record<string, string | undefined>;

export type HmacPurpose = "otp-code" | "telephone" | "piece-identite" | "siret";

function hmacKey(purpose: HmacPurpose, env: Env = process.env): Buffer {
  const secret = env.VERIFICATION_HMAC_KEY?.trim() || env.SESSION_SECRET || "koudmen-dev-session";
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret), Buffer.from("koudmen:l2"), Buffer.from(`koudmen:verification:${purpose}`), 32));
}

export function hmacHex(purpose: HmacPurpose, value: string, env: Env = process.env): string {
  return createHmac("sha256", hmacKey(purpose, env)).update(value).digest("hex");
}

/** Comparaison à temps constant de deux chaînes hexadécimales (ou ASCII). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Clé maîtresse de développement (PUBLIQUE) : seulement pour l'adaptateur simulé, hors lancement. */
export const DEV_DOCUMENT_KEY_HEX = "6b6f75646d656e2d6465762d646f63756d656e742d6b65792d6e6f2d70726f6421";

/**
 * Clé maîtresse : `DOCUMENT_ENC_KEY` pour l'adaptateur `base-chiffree` (exigée), clé de développement pour `simule`.
 * Null si l'adaptateur réel n'a pas de clé valable (le dépôt est fermé).
 */
export function documentMasterKey(env: Env = process.env): Uint8Array | null {
  if (documentsAdapterName(env) === "base-chiffree") return parseDocumentKey(env.DOCUMENT_ENC_KEY);
  return fromHex(DEV_DOCUMENT_KEY_HEX.slice(0, 64));
}

const KEY_AAD = Buffer.from("koudmen:document-key:v1");

function seal(key: Uint8Array, plain: Buffer, aad: Buffer): { iv: Buffer; data: Buffer } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(aad);
  return { iv, data: Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]) };
}

function open(key: Uint8Array, iv: Buffer, data: Buffer, aad: Buffer): Buffer {
  if (iv.length !== 12 || data.length < 16) throw new Error("Chiffré mal formé.");
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAAD(aad);
  d.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
}

export type SealedDocument = { ciphertext: Buffer; iv: string; wrappedKey: string };

/** Chiffre un fichier : nouvelle clé de fichier, elle-même chiffrée par la clé maîtresse. AAD = identifiant du document. */
export function encryptDocument(bytes: Uint8Array, documentId: string, master: Uint8Array): SealedDocument {
  const fileKey = randomBytes(32);
  const body = seal(fileKey, Buffer.from(bytes), Buffer.from(`koudmen:document:${documentId}`));
  const wrapped = seal(master, fileKey, KEY_AAD);
  fileKey.fill(0);
  return {
    ciphertext: body.data,
    iv: body.iv.toString("base64url"),
    wrappedKey: `k1:${wrapped.iv.toString("base64url")}:${wrapped.data.toString("base64url")}`,
  };
}

/** Déchiffre un fichier. Lève une erreur avec une autre clé maîtresse ou un autre identifiant. */
export function decryptDocument(doc: { ciphertext: Uint8Array; iv: string; wrappedKey: string }, documentId: string, master: Uint8Array): Buffer {
  const [prefix, wIv, wData] = doc.wrappedKey.split(":");
  if (prefix !== "k1" || !wIv || !wData) throw new Error("Clé de fichier mal formée.");
  const fileKey = open(master, Buffer.from(wIv, "base64url"), Buffer.from(wData, "base64url"), KEY_AAD);
  try {
    return open(fileKey, Buffer.from(doc.iv, "base64url"), Buffer.from(doc.ciphertext), Buffer.from(`koudmen:document:${documentId}`));
  } finally {
    fileKey.fill(0);
  }
}

const FIELD_AAD = Buffer.from("koudmen:accompagnant-adresse:v1");

/** Champ court chiffré (adresse déclarée de l'accompagnant). Format `d1:<iv>:<données>`. */
export function encryptField(plain: string, master: Uint8Array): string {
  const s = seal(master, Buffer.from(plain, "utf8"), FIELD_AAD);
  return `d1:${s.iv.toString("base64url")}:${s.data.toString("base64url")}`;
}

export function decryptField(stored: string | null | undefined, master: Uint8Array | null): string | null {
  if (!stored || !master) return null;
  const [p, iv, data] = stored.split(":");
  if (p !== "d1" || !iv || !data) return null;
  try {
    return open(master, Buffer.from(iv, "base64url"), Buffer.from(data, "base64url"), FIELD_AAD).toString("utf8");
  } catch {
    return null;
  }
}
