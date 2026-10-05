import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "./session-token";

const secret = new TextEncoder().encode("un-secret-de-test-assez-long-pour-hs256-0123456789");
const other = new TextEncoder().encode("un-autre-secret-de-test-assez-long-pour-hs256-987654");

describe("jeton de session", () => {
  it("signe puis vérifie un jeton", async () => {
    const token = await signSessionToken({ sub: "u1", role: "FAMILLE", name: "Sandrine", demo: true, sv: 3 }, secret);
    await expect(verifySessionToken(token, secret)).resolves.toEqual({ sub: "u1", role: "FAMILLE", name: "Sandrine", demo: true, sv: 3 });
  });

  it("rejette un jeton signé avec un autre secret", async () => {
    const token = await signSessionToken({ sub: "u1", role: "OPERATEUR", name: "x", demo: false, sv: 0 }, other);
    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejette un jeton expiré", async () => {
    const token = await signSessionToken({ sub: "u1", role: "OPERATEUR", name: "x", demo: false, sv: 0 }, secret, -10);
    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("marque un jeton sans version (ancien format) avec sv = -1", async () => {
    const { SignJWT } = await import("jose");
    const old = await new SignJWT({ role: "FAMILLE", name: "x", demo: false })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("koudmen")
      .setExpirationTime("1h")
      .sign(secret);
    await expect(verifySessionToken(old, secret)).resolves.toMatchObject({ sub: "u1", sv: -1 });
  });

  it("session opérateur courte (12 h), autres rôles 7 jours", async () => {
    const { sessionMaxAgeFor } = await import("./session-token");
    expect(sessionMaxAgeFor("OPERATEUR")).toBe(12 * 3600);
    expect(sessionMaxAgeFor("FAMILLE")).toBe(7 * 24 * 3600);
  });

  it("rejette un jeton absent ou malformé", async () => {
    await expect(verifySessionToken(undefined, secret)).resolves.toBeNull();
    await expect(verifySessionToken("pas-un-jwt", secret)).resolves.toBeNull();
  });
});
