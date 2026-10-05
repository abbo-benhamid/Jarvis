import * as Crypto from 'expo-crypto';

/**
 * PKCE S256 (RFC 7636) pour POST /auth/code puis /auth/token.
 * Le vérificateur reste en mémoire, le temps de l'échange (2 min au plus).
 */

function base64url(octets: Uint8Array): string {
  let bin = '';
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Vérificateur : 32 octets aléatoires, soit 43 caractères base64url. */
export function creerVerificateur(): string {
  return base64url(Crypto.getRandomBytes(32));
}

/** Défi : SHA-256 du vérificateur, en base64url sans remplissage (43 caractères). */
export async function calculerDefi(verificateur: string): Promise<string> {
  const b64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verificateur, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Identifiant d'événement unique (idempotence de POST /evenements). */
export function nouvelIdEvenement(): string {
  return Crypto.randomUUID();
}
