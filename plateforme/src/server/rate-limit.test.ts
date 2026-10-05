import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { clientIpFrom, subjectHash, retryMessage, RATE_RULES } = await import("./rate-limit");

describe("limites de débit : fonctions pures", () => {
  it("lit l'IP posée par le proxy Vercel en priorité", () => {
    expect(clientIpFrom(new Headers({ "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIpFrom(new Headers())).toBe("inconnue");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "x".repeat(200) }))).toBe("inconnue");
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
