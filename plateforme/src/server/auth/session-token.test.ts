import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "./session-token";

const secret = new TextEncoder().encode("un-secret-de-test-assez-long-pour-hs256-0123456789");
const other = new TextEncoder().encode("un-autre-secret-de-test-assez-long-pour-hs256-987654");

describe("jeton de session", () => {
  it("signe puis vérifie un jeton", async () => {
    const token = await signSessionToken({ sub: "u1", role: "FAMILLE", name: "Sandrine", demo: true }, secret);
    await expect(verifySessionToken(token, secret)).resolves.toEqual({ sub: "u1", role: "FAMILLE", name: "Sandrine", demo: true });
  });

  it("rejette un jeton signé avec un autre secret", async () => {
    const token = await signSessionToken({ sub: "u1", role: "OPERATEUR", name: "x", demo: false }, other);
    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejette un jeton expiré", async () => {
    const token = await signSessionToken({ sub: "u1", role: "OPERATEUR", name: "x", demo: false }, secret, -10);
    await expect(verifySessionToken(token, secret)).resolves.toBeNull();
  });

  it("rejette un jeton absent ou malformé", async () => {
    await expect(verifySessionToken(undefined, secret)).resolves.toBeNull();
    await expect(verifySessionToken("pas-un-jwt", secret)).resolves.toBeNull();
  });
});
