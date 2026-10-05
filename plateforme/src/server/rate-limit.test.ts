import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { clientIpFrom, subjectHash, retryMessage, RATE_RULES } = await import("./rate-limit");

describe("limites de débit : fonctions pures", () => {
  it("Vercel : lit l'IP posée par le proxy Vercel en priorité", () => {
    const vercel = { TRUST_PROXY: "vercel" };
    expect(clientIpFrom(new Headers({ "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }), vercel)).toBe("1.2.3.4");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }), vercel)).toBe("5.6.7.8");
    expect(clientIpFrom(new Headers(), vercel)).toBe("inconnue");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "x".repeat(200) }), vercel)).toBe("inconnue");
    // Détection automatique : VERCEL=1 sans TRUST_PROXY.
    expect(clientIpFrom(new Headers({ "x-vercel-forwarded-for": "1.2.3.4" }), { VERCEL: "1" })).toBe("1.2.3.4");
  });

  it("PM1 : Clever Cloud → DERNIÈRE valeur de x-forwarded-for ; x-vercel-* et x-real-ip ignorés", () => {
    const cc = { TRUST_PROXY: "clevercloud" };
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), cc)).toBe("203.0.113.9");
    expect(clientIpFrom(new Headers({ "x-vercel-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7", "x-forwarded-for": "203.0.113.9" }), cc)).toBe("203.0.113.9");
    expect(clientIpFrom(new Headers(), cc)).toBe("inconnue");
  });

  it("PM1 : sans proxy de confiance, aucun en-tête n'est cru (IP falsifiée sans effet)", () => {
    for (const env of [{}, { TRUST_PROXY: "aucun" }, { TRUST_PROXY: "nimporte" }]) {
      expect(clientIpFrom(new Headers({ "x-forwarded-for": "1.1.1.1", "x-vercel-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3" }), env)).toBe("inconnue");
    }
  });

  it("garde une empreinte stable, jamais la valeur en clair", () => {
    const h = subjectHash("Nadia@Exemple.test");
    expect(h).toHaveLength(32);
    expect(h).toBe(subjectHash("nadia@exemple.test "));
    expect(h).not.toContain("nadia");
  });

  it("écrit un message court avec le délai", () => {
    expect(retryMessage(30)).toBe("Trop d'essais. Réessayez dans une minute.");
    expect(retryMessage(14 * 60)).toBe("Trop d'essais. Réessayez dans 14 minutes.");
    expect(retryMessage(5 * 3600)).toBe("Trop d'essais. Réessayez dans 5 heures.");
  });

  it("couvre les 5 entrées demandées (connexion, code testeur, avis, événements, offre découverte)", () => {
    const names = Object.keys(RATE_RULES);
    for (const prefix of ["login:", "code-testeur:", "avis:", "evenement", "decouverte:"]) {
      expect(names.some((n) => n.startsWith(prefix))).toBe(true);
    }
    expect(RATE_RULES["avis:ip"].limit).toBeLessThanOrEqual(5);
  });
});
