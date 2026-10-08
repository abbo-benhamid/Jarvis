/**
 * L2 (étude § 7.2.6) : contrôle des fichiers à l'arrivée. Fonctions PURES.
 * - Type RÉEL lu dans les premiers octets (PDF, JPEG, PNG). L'extension et le type annoncé ne comptent pas.
 * - Taille : 5 Mo au plus.
 * - Métadonnées retirées : EXIF/XMP des JPEG (segments APP1 à APP15, commentaires), textes et EXIF des PNG.
 *   (Position GPS, modèle d'appareil.) Les PDF sont gardés tels quels [À VÉRIFIER : nettoyage des métadonnées PDF].
 * [À VÉRIFIER] Analyse antivirus (ClamAV) : pas en V1.1 ; le fichier n'est jamais exécuté ni servi en public.
 */
import { TAILLE_MAX_DOCUMENT, TYPES_DOCUMENT_ACCEPTES } from "@/contracts/v1/verifications";

export type AcceptedMime = (typeof TYPES_DOCUMENT_ACCEPTES)[number];

export function detectMime(bytes: Uint8Array): AcceptedMime | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  return null;
}

export type FileCheck = { ok: true; mime: AcceptedMime; bytes: Uint8Array } | { ok: false; reason: "VIDE" | "TROP_GROS" | "TYPE" };

export function checkUpload(bytes: Uint8Array): FileCheck {
  if (bytes.length === 0) return { ok: false, reason: "VIDE" };
  if (bytes.length > TAILLE_MAX_DOCUMENT) return { ok: false, reason: "TROP_GROS" };
  const mime = detectMime(bytes);
  if (!mime) return { ok: false, reason: "TYPE" };
  return { ok: true, mime, bytes: stripMetadata(bytes, mime) };
}

/** JPEG : retire APP1..APP15 (EXIF, XMP, IPTC) et COM. Garde APP0 (JFIF) et l'image. En cas de doute : fichier inchangé. */
export function stripJpeg(bytes: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return bytes;
    const marker = bytes[i + 1]!;
    // Début des données de l'image (SOS) : on copie tout le reste.
    if (marker === 0xda) {
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]!);
      return Uint8Array.from(out);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (len < 2 || i + 2 + len > bytes.length) return bytes;
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) for (let j = i; j < i + 2 + len; j++) out.push(bytes[j]!);
    i += 2 + len;
  }
  return bytes;
}

const PNG_DROP = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

/** PNG : retire les blocs de texte, EXIF et date. */
export function stripPng(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const len = ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    const end = i + 12 + len;
    if (end > bytes.length) return bytes;
    if (!PNG_DROP.has(type)) parts.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function stripMetadata(bytes: Uint8Array, mime: AcceptedMime): Uint8Array {
  if (mime === "image/jpeg") return stripJpeg(bytes);
  if (mime === "image/png") return stripPng(bytes);
  return bytes;
}
