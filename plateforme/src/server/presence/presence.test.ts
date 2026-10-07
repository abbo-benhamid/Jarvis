import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { DEV_QR_SEED_HEX, parseQrSigningKey, presenceConfigProblems, resolveQrKey } from "./config";
import { homeCardQrContent, newHomeCardId, qrKeyPair, signHomeCardToken, tokenFromQr, verifyHomeCardToken } from "./qr-token";
import { decryptAddress, encryptAddress } from "./address-crypto";
import { presenceRefusal, realDataAllowedLocal } from "@/server/visits/launch-guards";
import { evaluateGps, GPS_RADIUS_METERS, roundDistance } from "@/server/visits/proof";
import { qrMatrix } from "@/lib/qr";

const KEY_A = "jIFap7/9yWO0DJl/S2PvASG4xcd3hgd7q+0ccZQ+pow=";
const KEY_B = "Irx0YGksVDcEh69UBRXldm7oy3x0BJoXwJNYVvDPfBk=";
const PROD = { VERCEL_ENV: "production" };

describe("clés L1-B (config-check)", () => {
  it("hors production stricte : aucune exigence, clé de développement", () => {
    expect(presenceConfigProblems({})).toEqual([]);
    const k = resolveQrKey({});
    expect(k.kind === "seed" && Buffer.from(k.seed).toString("hex")).toBe(DEV_QR_SEED_HEX);
  });

  it("production stricte : clés obligatoires, jamais d'exemple ni la clé de développement", () => {
    expect(presenceConfigProblems(PROD).join(" ")).toMatch(/QR_SIGNING_KEY manquant.*ADDRESS_ENC_KEY manquant/);
    expect(presenceConfigProblems({ ...PROD, QR_SIGNING_KEY: "remplacez-moi", ADDRESS_ENC_KEY: KEY_B }).join(" ")).toContain("valeur d'exemple");
    const dev = Buffer.from(DEV_QR_SEED_HEX, "hex").toString("base64");
    expect(presenceConfigProblems({ ...PROD, QR_SIGNING_KEY: dev, ADDRESS_ENC_KEY: KEY_B }).join(" ")).toContain("clé de développement");
    expect(presenceConfigProblems({ ...PROD, QR_SIGNING_KEY: "abc", ADDRESS_ENC_KEY: KEY_B }).join(" ")).toContain("bonne forme");
    expect(presenceConfigProblems({ ...PROD, QR_SIGNING_KEY: KEY_A, ADDRESS_ENC_KEY: KEY_A }).join(" ")).toContain("différentes");
    expect(presenceConfigProblems({ ...PROD, QR_SIGNING_KEY: KEY_A, ADDRESS_ENC_KEY: KEY_B })).toEqual([]);
    expect(() => resolveQrKey(PROD)).toThrow();
  });

  it("accepte une clé PKCS#8 PEM Ed25519 (avec \\n échappés)", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString().replace(/\n/g, "\\n");
    expect(parseQrSigningKey(pem)?.kind).toBe("pem");
    expect(() => qrKeyPair({ QR_SIGNING_KEY: pem })).not.toThrow();
  });
});

describe("jeton de la carte domicile (L9, R7)", () => {
  it("signe { c, v } en EdDSA ; la charge ne contient pas l'id de l'aîné", async () => {
    const c = newHomeCardId();
    const token = await signHomeCardToken({ c, v: 3 });
    const [header, payload] = token.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "EdDSA" });
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString())).toEqual({ c, v: 3 });
    expect(await verifyHomeCardToken(token)).toEqual({ c, v: 3 });
  });

  it("refuse un jeton modifié, signé par une autre clé, ou mal formé", async () => {
    const token = await signHomeCardToken({ c: newHomeCardId(), v: 1 });
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ c: newHomeCardId(), v: 1 })).toString("base64url")}.${s}`;
    expect(await verifyHomeCardToken(forged)).toBeNull();
    const other = qrKeyPair({ QR_SIGNING_KEY: KEY_A });
    expect(await verifyHomeCardToken(await signHomeCardToken({ c: newHomeCardId(), v: 1 }, other.privateKey))).toBeNull();
    expect(await verifyHomeCardToken("pas-un-jeton")).toBeNull();
    expect(await verifyHomeCardToken(`${h}.e30.${s}`)).toBeNull();
  });

  it("contenu du QR : koudmen:domicile:s1:<jeton>, lisible par tokenFromQr, et tient dans le QR (version ≤ 10)", async () => {
    const token = await signHomeCardToken({ c: newHomeCardId(), v: 12 });
    const content = homeCardQrContent(token);
    expect(content.startsWith("koudmen:domicile:s1:")).toBe(true);
    expect(tokenFromQr(content)).toBe(token);
    expect(tokenFromQr(token)).toBe(token);
    expect(tokenFromQr("koudmen:domicile:LKW7Q3")).toBeNull();
    expect(tokenFromQr("koudmen:domicile:s2:abc.def.ghi")).toBeNull();
    expect(() => qrMatrix(content)).not.toThrow();
  });
});

describe("adresse chiffrée (R7)", () => {
  it("chiffre et déchiffre ; un autre chiffrement à chaque fois ; clé fausse → null", () => {
    const a = encryptAddress("12 rue Victor Hugo, 97200 Fort-de-France");
    const b = encryptAddress("12 rue Victor Hugo, 97200 Fort-de-France");
    expect(a).not.toBe(b);
    expect(a.startsWith("a1:")).toBe(true);
    expect(a).not.toContain("Victor");
    expect(decryptAddress(a)).toBe("12 rue Victor Hugo, 97200 Fort-de-France");
    expect(decryptAddress(a, Buffer.from(KEY_B, "base64"))).toBeNull();
    expect(decryptAddress("a1:xx:yy")).toBeNull();
    expect(decryptAddress(null)).toBeNull();
  });
});

describe("garde-fous du lancement (R1/R5, interface locale)", () => {
  const aine = { consentGiven: true, consentAt: new Date(), sandboxId: null };
  it("hors production stricte : permis si l'accord est enregistré", () => {
    expect(realDataAllowedLocal({})).toBe(true);
    expect(presenceRefusal(aine, {})).toBeNull();
    expect(presenceRefusal({ ...aine, consentGiven: false }, {})).toBe("ACCORD_MANQUANT");
  });
  it("production stricte : refusé sans DONNEES_REELLES_AUTORISEES=true (sauf aîné de bac à sable)", () => {
    expect(presenceRefusal(aine, PROD)).toBe("DONNEES_REELLES_NON_AUTORISEES");
    // Fusion L1-A : le drapeau exige aussi HEBERGEUR_HDS, AIPD_DATE et DPO_CONTACT.
    expect(presenceRefusal(aine, { ...PROD, DONNEES_REELLES_AUTORISEES: "true" })).toBe("DONNEES_REELLES_NON_AUTORISEES");
    expect(presenceRefusal(aine, { ...PROD, DONNEES_REELLES_AUTORISEES: "true", HEBERGEUR_HDS: "HDS", AIPD_DATE: "2026-12-01", DPO_CONTACT: "dpo@x.fr" })).toBeNull();
    expect(presenceRefusal({ ...aine, accordEtat: "EN_ATTENTE_ACCORD" }, {})).toBe("ACCORD_MANQUANT");
    expect(presenceRefusal({ ...aine, sandboxId: "sb1" }, PROD)).toBeNull();
  });
});

describe("position du check-in (L10)", () => {
  const home = { lat: 14.6161, lng: -61.0588, approximate: false };
  it("≤ 150 m : valide ; distance arrondie à la dizaine", () => {
    const r = evaluateGps({ lat: 14.617, lng: -61.0588, accuracy: 20 }, home);
    expect(r).toMatchObject({ valid: true });
    expect(r.distanceMeters % 10).toBe(0);
    expect(GPS_RADIUS_METERS).toBe(150);
  });
  it("la précision s'ajoute au rayon, 50 m au plus", () => {
    // ~180 m du domicile.
    const p = { lat: 14.6161 + 180 / 111_320, lng: -61.0588 };
    expect(evaluateGps({ ...p, accuracy: 40 }, home).valid).toBe(true);
    expect(evaluateGps({ ...p, accuracy: 10 }, home)).toMatchObject({ valid: false, reason: "TROP_LOIN" });
  });
  it("précision > 150 m, position simulée, domicile approximatif → non valide", () => {
    expect(evaluateGps({ lat: 14.6161, lng: -61.0588, accuracy: 200 }, home).reason).toBe("PRECISION_FAIBLE");
    expect(evaluateGps({ lat: 14.6161, lng: -61.0588, accuracy: 5, mocked: true }, home).reason).toBe("SIMULEE");
    expect(evaluateGps({ lat: 14.6161, lng: -61.0588, accuracy: 5 }, { ...home, approximate: true }).reason).toBe("DOMICILE_APPROXIMATIF");
    expect(roundDistance(144)).toBe(140);
  });
});
