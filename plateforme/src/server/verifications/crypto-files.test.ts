import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptDocument, decryptField, documentMasterKey, encryptDocument, encryptField, hmacHex } from "./crypto";
import { checkUpload, detectMime, stripJpeg, stripPng } from "./files";
import { companyDocAlways, documentsAvailable, identityAvailable, smsAvailable, verificationConfigProblems, verificationConfigWarnings } from "./config";

const KEY = randomBytes(32);

describe("L2 : chiffrement des documents (enveloppe AES-256-GCM)", () => {
  it("aller-retour ; illisible avec une autre clé ou un autre identifiant", () => {
    const bytes = Buffer.from("%PDF-1.4 justificatif fictif");
    const sealed = encryptDocument(bytes, "doc1", KEY);
    expect(Buffer.from(sealed.ciphertext).includes(Buffer.from("justificatif"))).toBe(false);
    expect(decryptDocument(sealed, "doc1", KEY).toString()).toBe(bytes.toString());
    expect(() => decryptDocument(sealed, "doc1", randomBytes(32))).toThrow();
    expect(() => decryptDocument(sealed, "doc2", KEY)).toThrow();
  });
  it("adresse chiffrée ; clé maîtresse exigée pour l'adaptateur réel", () => {
    const enc = encryptField("12 rue des Flamboyants", KEY);
    expect(decryptField(enc, KEY)).toBe("12 rue des Flamboyants");
    expect(decryptField(enc, randomBytes(32))).toBeNull();
    expect(documentMasterKey({ ADAPTER_DOCUMENTS: "base-chiffree" })).toBeNull();
    expect(documentMasterKey({ ADAPTER_DOCUMENTS: "base-chiffree", DOCUMENT_ENC_KEY: KEY.toString("base64") })).toEqual(new Uint8Array(KEY));
    expect(documentMasterKey({ ADAPTER_DOCUMENTS: "base-chiffree", DOCUMENT_ENC_KEY: Buffer.alloc(32).toString("base64") })).toBeNull();
  });
  it("empreintes HMAC distinctes par usage", () => {
    const env = { SESSION_SECRET: "s".repeat(40) };
    expect(hmacHex("telephone", "+596696123456", env)).not.toBe(hmacHex("otp-code", "+596696123456", env));
    expect(hmacHex("telephone", "+596696123456", env)).toHaveLength(64);
  });
});

describe("L2 : contrôle des fichiers", () => {
  it("type réel par les premiers octets", () => {
    expect(detectMime(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(detectMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectMime(Buffer.from("<html>"))).toBeNull();
    expect(checkUpload(Buffer.from("MZ\x90\x00 exe déguisé en pdf"))).toEqual({ ok: false, reason: "TYPE" });
    expect(checkUpload(Buffer.alloc(0))).toEqual({ ok: false, reason: "VIDE" });
    expect(checkUpload(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(5 * 1024 * 1024)]))).toEqual({ ok: false, reason: "TROP_GROS" });
  });
  it("JPEG : retire EXIF (APP1) et commentaire, garde l'image", () => {
    const seg = (m: number, payload: Buffer) => Buffer.concat([Buffer.from([0xff, m, (payload.length + 2) >> 8, (payload.length + 2) & 255]), payload]);
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      seg(0xe0, Buffer.from("JFIF\0")),
      seg(0xe1, Buffer.from("Exif\0\0GPS 14.6N 61.0W")),
      seg(0xfe, Buffer.from("commentaire")),
      Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
    ]);
    const out = Buffer.from(stripJpeg(jpeg));
    expect(out.includes(Buffer.from("GPS"))).toBe(false);
    expect(out.includes(Buffer.from("commentaire"))).toBe(false);
    expect(out.includes(Buffer.from("JFIF"))).toBe(true);
    expect(out.subarray(-4)).toEqual(Buffer.from([0x11, 0x22, 0xff, 0xd9]));
  });
  it("PNG : retire les blocs de texte", () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
    };
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", Buffer.alloc(13)), chunk("tEXt", Buffer.from("Author\0Josiane")), chunk("IDAT", Buffer.from("xx")), chunk("IEND", Buffer.alloc(0))]);
    const out = Buffer.from(stripPng(png));
    expect(out.includes(Buffer.from("Josiane"))).toBe(false);
    expect(out.includes(Buffer.from("IDAT"))).toBe(true);
  });
});

describe("L2 : configuration (simulé par défaut, avertissements, jamais de 503 en préinscription)", () => {
  it("simulé : ouvert en essai, fermé en lancement", () => {
    expect(smsAvailable({ KOUDMEN_MODE: "essai" })).toBe(true);
    expect(smsAvailable({ KOUDMEN_MODE: "lancement" })).toBe(false);
    expect(identityAvailable({ KOUDMEN_MODE: "lancement", ADAPTER_IDENTITY: "veriff" })).toBe(false);
    expect(identityAvailable({ KOUDMEN_MODE: "lancement", ADAPTER_IDENTITY: "veriff", VERIFF_API_KEY: "a", VERIFF_SHARED_SECRET: "b" })).toBe(true);
    expect(documentsAvailable({ KOUDMEN_MODE: "lancement", ADAPTER_DOCUMENTS: "base-chiffree", DOCUMENT_ENC_KEY: KEY.toString("base64") })).toBe(true);
    expect(companyDocAlways({ COMPANY_DOC_REQUIRED: "toujours" })).toBe(true);
  });
  it("lancement en préinscription : avertissements, aucun problème bloquant", () => {
    const env = { KOUDMEN_MODE: "lancement", ADAPTER_OTP: "brevo", BREVO_API_KEY: "k", ADAPTER_IDENTITY: "veriff", ADAPTER_DOCUMENTS: "base-chiffree", DOCUMENT_ENC_KEY: "court" };
    const w = verificationConfigWarnings(env).join("\n");
    expect(w).toMatch(/ADAPTER_OTP=brevo sans BREVO_SMS_SENDER/);
    expect(w).toMatch(/ADAPTER_IDENTITY=veriff sans VERIFF_API_KEY, VERIFF_SHARED_SECRET/);
    expect(w).toMatch(/DOCUMENT_ENC_KEY n'a pas la bonne forme/);
    expect(w).toMatch(/ADAPTER_SIRENE=simule en lancement/);
    expect(w).not.toMatch(/court|"k"/);
    expect(verificationConfigProblems(env)).toEqual([]);
  });
  it("données réelles ouvertes : une clé de documents fausse bloque", () => {
    const env = { KOUDMEN_MODE: "lancement", DONNEES_REELLES_AUTORISEES: "true", HEBERGEUR_HDS: "x", AIPD_DATE: "2026-01-01", DPO_CONTACT: "d", DOCUMENT_ENC_KEY: "court" };
    expect(verificationConfigProblems(env)).toHaveLength(1);
    expect(verificationConfigWarnings({ KOUDMEN_MODE: "essai" })).toEqual([]);
  });
});
