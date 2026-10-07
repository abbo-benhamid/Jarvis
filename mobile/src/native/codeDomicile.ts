/**
 * Contenu du QR code affiché au domicile (lot M4). Module PUR : aucun import React Native.
 *
 * | Contenu du QR                    | Résultat                                     |
 * |----------------------------------|----------------------------------------------|
 * | `KDM482` (code seul)             | `lisible`, code `KDM482` (QR actuels)        |
 * | `koudmen:domicile:KDM482`        | `lisible` (format v1, à imprimer désormais)  |
 * | `koudmen:domicile:s1:<jeton>`    | `signe` (carte domicile, JWS EdDSA, L1 L9)   |
 * | `koudmen:domicile:s2:…` et plus  | erreur `VERSION_INCONNUE` (app à mettre à jour) |
 * | autre chose                      | erreur `INCONNU`                             |
 *
 * L1 (§ 2.3) : le jeton signé part dans `qr` de l'événement CHECK_IN (contrat provisoire `src/contrats-l1`).
 * Le serveur vérifie signature, version, aîné, fenêtre et distance (L10).
 * Ni le code ni le jeton ne sont gardés sur le téléphone : ils restent en mémoire jusqu'à l'envoi.
 */

export const PREFIXE_QR_DOMICILE = 'koudmen:domicile:';

/** Code lisible : 4 à 12 lettres ou chiffres (le serveur utilise 6 caractères aujourd'hui). */
const CODE = /^[A-Z0-9]{4,12}$/;
/** Jeton signé futur : base64url, en un ou plusieurs segments séparés par des points (JWS). */
const JETON = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

export type LectureQr =
  | { ok: true; format: 'lisible'; code: string }
  | { ok: true; format: 'signe'; version: string; jeton: string }
  | { ok: false; raison: 'VIDE' | 'INCONNU' | 'VERSION_INCONNUE'; message: string };

export const MESSAGES_QR = {
  VIDE: 'Le QR code est vide. Entrez le code à la main.',
  INCONNU: 'Ce QR code n’est pas un code Koudmen. Entrez le code à la main.',
  VERSION_INCONNUE: 'Ce QR code vient d’une version plus récente. Mettez l’app à jour, ou entrez le code à la main.',
} as const;

/** Normalise une saisie : majuscules, sans espace ni tiret (comme le champ de la fiche). */
export function normaliserCode(texte: string): string {
  return texte.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

export function lireQrDomicile(brut: string): LectureQr {
  const texte = brut.trim();
  if (!texte) return { ok: false, raison: 'VIDE', message: MESSAGES_QR.VIDE };

  if (texte.toLowerCase().startsWith(PREFIXE_QR_DOMICILE)) {
    const reste = texte.slice(PREFIXE_QR_DOMICILE.length).trim();
    const deuxPoints = reste.indexOf(':');
    if (deuxPoints === -1) {
      const code = reste.toUpperCase();
      return CODE.test(code) ? { ok: true, format: 'lisible', code } : inconnu();
    }
    const version = reste.slice(0, deuxPoints).toLowerCase();
    const charge = reste.slice(deuxPoints + 1).trim();
    if (version === 's1') return JETON.test(charge) ? { ok: true, format: 'signe', version, jeton: charge } : inconnu();
    if (/^s\d+$/.test(version)) return { ok: false, raison: 'VERSION_INCONNUE', message: MESSAGES_QR.VERSION_INCONNUE };
    return inconnu();
  }

  const code = texte.toUpperCase();
  return CODE.test(code) ? { ok: true, format: 'lisible', code } : inconnu();
}

/** Texte à mettre dans le QR imprimé (format v1). */
export function contenuQrDomicile(code: string): string {
  return `${PREFIXE_QR_DOMICILE}${normaliserCode(code)}`;
}

function inconnu(): LectureQr {
  return { ok: false, raison: 'INCONNU', message: MESSAGES_QR.INCONNU };
}
