import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  bearerToken,
  deriveKey,
  generateRefreshToken,
  hashRefreshToken,
  pkceChallenge,
  pkceMatches,
  signAccessToken,
  signAuthCode,
  verifyAccessToken,
  verifyAuthCode,
} from "./token";
import { signSessionToken } from "./session-token";
import { codeChallengeSchema, jetonRenouvellementSchema } from "@/contracts/v1/auth";

const secret = new TextEncoder().encode("secret-de-test-pour-les-jetons-api-v1-0123456789");
const acces = deriveKey(secret, "acces");
const codeKey = deriveKey(secret, "code");
const claims = { sub: "u1", role: "ACCOMPAGNANT" as const, sv: 3, fid: "fam-1" };

describe("dérivation des clés", () => {
  it("une clé différente par usage, et différente du secret de session", () => {
    expect(Buffer.from(acces).equals(Buffer.from(codeKey))).toBe(false);
    expect(acces).toHaveLength(32);
    expect(Buffer.from(acces).equals(Buffer.from(secret.slice(0, 32)))).toBe(false);
  });
});

describe("jeton d'accès", () => {
  it("aller-retour, puis expiré après 15 minutes", async () => {
    const t0 = new Date("2026-10-05T10:00:00Z");
    const token = await signAccessToken(claims, acces, t0);
    expect(await verifyAccessToken(token, acces, new Date(t0.getTime() + 14 * 60_000))).toEqual(claims);
    expect(await verifyAccessToken(token, acces, new Date(t0.getTime() + 16 * 60_000))).toBeNull();
  });

  it("refuse une autre clé, un code de connexion et un cookie de session web", async () => {
    const token = await signAccessToken(claims, acces);
    expect(await verifyAccessToken(token, codeKey)).toBeNull();
    const { code } = await signAuthCode({ sub: "u1", sv: 3, cc: "x".repeat(43) }, acces);
    expect(await verifyAccessToken(code, acces)).toBeNull();
    const web = await signSessionToken({ sub: "u1", role: "ACCOMPAGNANT", name: "J", demo: false, sv: 3 }, secret);
    expect(await verifyAccessToken(web, acces)).toBeNull();
    expect(await verifyAccessToken(web, secret)).toBeNull();
  });

  it("refuse alg none, un jeton modifié, des champs manquants", async () => {
    const token = await signAccessToken(claims, acces);
    const [h, p] = token.split(".");
    const forged = JSON.parse(Buffer.from(p!, "base64url").toString());
    forged.role = "OPERATEUR";
    expect(await verifyAccessToken(`${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${token.split(".")[2]}`, acces)).toBeNull();
    const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "at+jwt" })).toString("base64url")}.${p}.`;
    expect(await verifyAccessToken(none, acces)).toBeNull();
    const noFid = await new SignJWT({ role: "ACCOMPAGNANT", sv: 1 })
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
      .setSubject("u1")
      .setIssuer("koudmen")
      .setAudience("koudmen:api:v1")
      .setExpirationTime("5m")
      .sign(acces);
    expect(await verifyAccessToken(noFid, acces)).toBeNull();
    expect(await verifyAccessToken(null, acces)).toBeNull();
    expect(await verifyAccessToken("x".repeat(3000), acces)).toBeNull();
  });
});

describe("en-tête Authorization", () => {
  it("lit seulement « Bearer <jeton> »", () => {
    expect(bearerToken("Bearer abc.def-ghi_jkl")).toBe("abc.def-ghi_jkl");
    expect(bearerToken("bearer abc")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("code de connexion et PKCE", () => {
  it("exemple de la RFC 7636 (annexe B)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(pkceMatches("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(true);
    expect(pkceMatches("autre-verificateur-autre-verificateur-autre-v", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(false);
    expect(pkceMatches("x", "court")).toBe(false);
    expect(codeChallengeSchema.safeParse(pkceChallenge("n'importe quoi")).success).toBe(true);
  });

  it("code : aller-retour, expiré après 2 minutes, refusé avec la clé d'accès", async () => {
    const t0 = new Date("2026-10-05T10:00:00Z");
    const { code, jti } = await signAuthCode({ sub: "u1", sv: 0, cc: "c".repeat(43) }, codeKey, t0);
    expect(await verifyAuthCode(code, codeKey, new Date(t0.getTime() + 60_000))).toEqual({ sub: "u1", sv: 0, cc: "c".repeat(43), jti });
    expect(await verifyAuthCode(code, codeKey, new Date(t0.getTime() + 3 * 60_000))).toBeNull();
    expect(await verifyAuthCode(code, acces, t0)).toBeNull();
    const access = await signAccessToken(claims, codeKey, t0);
    expect(await verifyAuthCode(access, codeKey, t0)).toBeNull();
  });
});

describe("jeton de renouvellement", () => {
  it("opaque, unique, conforme au contrat ; l'empreinte ne contient pas le jeton", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^kr1_[A-Za-z0-9_-]{43}$/);
    expect(jetonRenouvellementSchema.safeParse(a).success).toBe(true);
    const h = hashRefreshToken(a);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(a.slice(4, 20));
    expect(hashRefreshToken(a)).toBe(h);
  });
});
