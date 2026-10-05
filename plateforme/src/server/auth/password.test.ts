import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, verifyPasswordForUnknownAccount } from "./password";

describe("mots de passe (sécurité m1 : pas d'énumération par le temps de réponse)", () => {
  it("un compte inconnu fait le même calcul bcrypt et retourne toujours false", async () => {
    const h = await hashPassword("motdepasse-123");
    const t0 = performance.now();
    expect(await verifyPassword("motdepasse-123", h)).toBe(true);
    const known = performance.now() - t0;
    await verifyPasswordForUnknownAccount("x"); // premier appel : calcule l'empreinte factice
    const t1 = performance.now();
    expect(await verifyPasswordForUnknownAccount("motdepasse-123")).toBe(false);
    const unknown = performance.now() - t1;
    // Même ordre de grandeur (bcrypt, 10 tours) : jamais « 8 ms contre 350 ms ».
    expect(unknown).toBeGreaterThan(known / 4);
  });
});
