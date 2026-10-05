import { describe, expect, it } from "vitest";
import {
  assertProductionConfig,
  isStrictProduction,
  productionConfigProblems,
  secretProblem,
  testerCodeProblem,
} from "./config-check";
import { generateTesterCode } from "./tester-codes";

const STRONG_A = "q8R2vXk1Zt7LmN4pW9sYc3Hd6Jf0Gb5Ue8Ai2Ko7Tr1Vn4Mx6Pz9Lq3Sw5Dy0Hj";
const STRONG_B = "Zp4Wq9Ls2Kx7Nv1Bt6Mc3Rf8Hg5Jd0Ya2Uo7Ie4Tn9Sm1Vb6Xc3Lk8Pq5Dw0Gh";

function prodEnv(over: Record<string, string | undefined> = {}) {
  return {
    VERCEL_ENV: "production",
    SESSION_SECRET: STRONG_A,
    CRON_SECRET: STRONG_B,
    TESTER_INVITE_CODES: `${generateTesterCode()},${generateTesterCode()}`,
    ...over,
  };
}

describe("configuration de production (B1, B3)", () => {
  it("n'est stricte que sur Vercel production ou avec KOUDMEN_STRICT_CONFIG", () => {
    expect(isStrictProduction({ NODE_ENV: "production" })).toBe(false);
    expect(isStrictProduction({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isStrictProduction({ VERCEL_ENV: "production" })).toBe(true);
    expect(isStrictProduction({ KOUDMEN_STRICT_CONFIG: "true" })).toBe(true);
  });

  it("accepte une configuration aléatoire", () => {
    expect(productionConfigProblems(prodEnv())).toEqual([]);
    expect(() => assertProductionConfig(prodEnv())).not.toThrow();
  });

  it("refuse les valeurs d'exemple de .env.example et de la CI", () => {
    const problems = productionConfigProblems(
      prodEnv({
        SESSION_SECRET: "remplacez-moi-par-une-valeur-aleatoire-de-48-caracteres",
        CRON_SECRET: "ci-cron-secret-0123456789",
        TESTER_INVITE_CODES: "CODE-A-REMPLACER-1,E2E-CODE-FACTICE-CI",
      }),
    );
    expect(problems.some((p) => p.startsWith("SESSION_SECRET est une valeur d'exemple"))).toBe(true);
    expect(problems.some((p) => p.startsWith("CRON_SECRET"))).toBe(true);
    expect(problems.filter((p) => p.startsWith("TESTER_INVITE_CODES"))).toHaveLength(2);
    expect(() => assertProductionConfig(prodEnv({ SESSION_SECRET: "remplacez-moi-par-une-valeur-aleatoire-de-48-caracteres" }))).toThrow(
      "Configuration de production refusée",
    );
  });

  it("refuse le secret de CI, un secret court ou répétitif, et deux secrets identiques", () => {
    expect(secretProblem("S", "ci-secret-uniquement-pour-les-tests-0123456789abcdef")).toMatch("exemple");
    expect(secretProblem("S", "abc")).toMatch("trop court");
    expect(secretProblem("S", undefined)).toMatch("manquant");
    expect(secretProblem("S", "ab".repeat(30))).toMatch("aléatoire");
    expect(productionConfigProblems(prodEnv({ CRON_SECRET: STRONG_A }))).toContain("SESSION_SECRET et CRON_SECRET doivent être différents.");
  });

  it("refuse les anciens codes publics, les codes courts et la coupure des limites de débit", () => {
    expect(testerCodeProblem("NADIA-07")).toMatch("public");
    expect(testerCodeProblem("LOCAL-01")).toMatch("public");
    expect(testerCodeProblem("ABC-1234")).toMatch("moins de 12");
    expect(testerCodeProblem("T-------------")).not.toBeNull();
    expect(productionConfigProblems(prodEnv({ TESTER_INVITE_CODES: "" }))).toContain("TESTER_INVITE_CODES est vide.");
    expect(productionConfigProblems(prodEnv({ RATE_LIMIT_DISABLED: "true" }))).toContain("RATE_LIMIT_DISABLED est interdit en production.");
    expect(productionConfigProblems(prodEnv({ TEST_END_DATE: "fin octobre" }))).toHaveLength(1);
  });

  it("PM1 : TRUST_PROXY inconnu refusé en production ; vercel, clevercloud et aucun acceptés", () => {
    const base = { VERCEL_ENV: "production" };
    expect(productionConfigProblems({ ...base, TRUST_PROXY: "nginx" }).join(" ")).toContain("TRUST_PROXY");
    for (const v of ["vercel", "clevercloud", "aucun"]) expect(productionConfigProblems({ ...base, TRUST_PROXY: v }).join(" ")).not.toContain("TRUST_PROXY");
  });

  it("ne contrôle rien hors production (local, CI, e2e)", () => {
    expect(productionConfigProblems({ NODE_ENV: "production", SESSION_SECRET: "remplacez-moi", TESTER_INVITE_CODES: "E2E-TEST" })).toEqual([]);
  });

  it("génère des codes longs, aléatoires et acceptés", () => {
    const codes = new Set(Array.from({ length: 200 }, generateTesterCode));
    expect(codes.size).toBe(200);
    for (const c of codes) {
      expect(c).toMatch(/^T-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(testerCodeProblem(c)).toBeNull();
    }
  });
});
