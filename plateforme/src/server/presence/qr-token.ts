/**
 * L1-B (L9, R7) : jeton signé de la carte domicile. Fichier sans base de données (testable seul).
 *
 * Contenu du QR : `koudmen:domicile:s1:<jeton>` (format déjà lu par l'app : `mobile/src/native/codeDomicile.ts`).
 * Jeton = JWS compact EdDSA (Ed25519), en-tête `{ alg: "EdDSA" }`, charge `{ c: <id aléatoire de carte>, v: <version> }`.
 * R7 : la charge ne contient JAMAIS l'id de l'aîné. Le serveur relie la carte à l'aîné (colonne `Aine.homeCardId`).
 * Pas de date d'expiration : la carte est imprimée. Une carte perdue se RÉGÉNÈRE (nouvel id, version + 1).
 */
import { createPrivateKey, createPublicKey, randomBytes, type KeyObject } from "node:crypto";
import { CompactSign, compactVerify } from "jose";
import { resolveQrKey, type QrKeySource } from "./config";

export const PREFIXE_QR_DOMICILE = "koudmen:domicile:";
export const VERSION_QR_SIGNE = "s1";

/** Charge du jeton. */
export type HomeCardClaims = { c: string; v: number };

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

type KeyPair = { privateKey: KeyObject; publicKey: KeyObject };
let cached: { fingerprint: string; pair: KeyPair } | null = null;

function keyPairFrom(source: QrKeySource): KeyPair {
  const privateKey =
    source.kind === "seed"
      ? createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(source.seed)]), format: "der", type: "pkcs8" })
      : createPrivateKey({ key: source.pem, format: "pem" });
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("QR_SIGNING_KEY doit être une clé Ed25519.");
  return { privateKey, publicKey: createPublicKey(privateKey) };
}

/** Paire de clés de la carte domicile (mise en cache tant que la variable ne change pas). */
export function qrKeyPair(env: Record<string, string | undefined> = process.env): KeyPair {
  const fingerprint = env.QR_SIGNING_KEY ?? "";
  if (cached && cached.fingerprint === fingerprint) return cached.pair;
  const pair = keyPairFrom(resolveQrKey(env));
  cached = { fingerprint, pair };
  return pair;
}

/** Nouvel identifiant de carte : 128 bits aléatoires, base64url (22 caractères). */
export function newHomeCardId(): string {
  return randomBytes(16).toString("base64url");
}

const CARD_ID = /^[A-Za-z0-9_-]{16,64}$/;

export async function signHomeCardToken(claims: HomeCardClaims, privateKey: KeyObject = qrKeyPair().privateKey): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ c: claims.c, v: claims.v }));
  return new CompactSign(payload).setProtectedHeader({ alg: "EdDSA" }).sign(privateKey);
}

/** Vérifie la signature et la forme de la charge. Null si le jeton est faux (aucun détail : pas d'oracle). */
export async function verifyHomeCardToken(token: string, publicKey: KeyObject = qrKeyPair().publicKey): Promise<HomeCardClaims | null> {
  if (token.length > 400 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const { payload } = await compactVerify(token, publicKey, { algorithms: ["EdDSA"] });
    const raw = JSON.parse(new TextDecoder().decode(payload)) as unknown;
    if (typeof raw !== "object" || raw === null) return null;
    const { c, v } = raw as Record<string, unknown>;
    if (typeof c !== "string" || !CARD_ID.test(c)) return null;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return null;
    return { c, v };
  } catch {
    return null;
  }
}

/** Texte à mettre dans le QR imprimé. */
export function homeCardQrContent(token: string): string {
  return `${PREFIXE_QR_DOMICILE}${VERSION_QR_SIGNE}:${token}`;
}

/**
 * Jeton lu dans le champ `qr` de l'app : contenu complet du QR (`koudmen:domicile:s1:<jeton>`) ou jeton seul.
 * Null si ce n'est pas un QR signé `s1`.
 */
export function tokenFromQr(raw: string): string | null {
  const t = raw.trim();
  const prefix = `${PREFIXE_QR_DOMICILE}${VERSION_QR_SIGNE}:`;
  if (t.toLowerCase().startsWith(prefix)) return t.slice(prefix.length).trim() || null;
  if (t.toLowerCase().startsWith(PREFIXE_QR_DOMICILE)) return null;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t) ? t : null;
}
