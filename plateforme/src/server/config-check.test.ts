import { describe, expect, it } from "vitest";
import {
  assertProductionConfig,
  configWarnings,
  isLaunchMode,
  isStrictProduction,
  launchRedirect,
  parseMailFrom,
  productionConfigProblems,
  realDataAllowedFrom,
  secretProblem,
  siteMode,
  testerCodeProblem,
} from "./config-check";
import { generateTesterCode } from "./tester-codes";

const STRONG_A = "q8R2vXk1Zt7LmN4pW9sYc3Hd6Jf0Gb5Ue8Ai2Ko7Tr1Vn4Mx6Pz9Lq3Sw5Dy0Hj";
const STRONG_B = "Zp4Wq9Ls2Kx7Nv1Bt6Mc3Rf8Hg5Jd0Ya2Uo7Ie4Tn9Sm1Vb6Xc3Lk8Pq5Dw0Gh";

const EDITOR = { EDITEUR_NOM: "Koudmen SAS", EDITEUR_ADRESSE: "1 rue de la Mer, 97200 Fort-de-France", EDITEUR_EMAIL: "contact@koudmen.fr", DIRECTEUR_PUBLICATION: "A. Fondateur" };

/** Production en mode ESSAI (bac à sable sur invitation) : les codes testeurs sont contrôlés. */
function prodEnv(over: Record<string, string | undefined> = {}) {
  return {
    VERCEL_ENV: "production",
    KOUDMEN_MODE: "essai",
    SESSION_SECRET: STRONG_A,
    CRON_SECRET: STRONG_B,
    TESTER_INVITE_CODES: `${generateTesterCode()},${generateTesterCode()}`,
    ...EDITOR,
    ...over,
  };
}

/** Production en mode LANCEMENT (défaut sur Vercel production). */
function launchEnv(over: Record<string, string | undefined> = {}) {
  return { VERCEL_ENV: "production", SESSION_SECRET: STRONG_A, CRON_SECRET: STRONG_B, ...EDITOR, ...over };
}

describe("L1 : mode du site", () => {
  it("lancement par défaut en production, essai en développement et en test ; KOUDMEN_MODE gagne", () => {
    expect(siteMode({ VERCEL_ENV: "production" })).toBe("lancement");
    expect(siteMode({ NODE_ENV: "production" })).toBe("lancement");
    expect(siteMode({ NODE_ENV: "development" })).toBe("essai");
    expect(siteMode({ NODE_ENV: "test" })).toBe("essai");
    expect(siteMode({ NODE_ENV: "production", KOUDMEN_MODE: "essai" })).toBe("essai");
    expect(siteMode({ NODE_ENV: "development", KOUDMEN_MODE: " Lancement " })).toBe("lancement");
    expect(isLaunchMode({ KOUDMEN_MODE: "n'importe quoi", NODE_ENV: "production" })).toBe(true);
  });

  it("refuse une valeur inconnue de KOUDMEN_MODE en production", () => {
    expect(productionConfigProblems(launchEnv({ KOUDMEN_MODE: "demo" }))).toContain("KOUDMEN_MODE doit valoir lancement ou essai.");
  });

  it("en lancement, les codes testeurs ne sont plus exigés", () => {
    expect(productionConfigProblems(launchEnv())).toEqual([]);
    expect(productionConfigProblems(launchEnv({ TESTER_INVITE_CODES: "NADIA-07" }))).toEqual([]);
  });

  it("redirige les pages du mode essai", () => {
    expect(launchRedirect("/tester")).toBe("/inscription");
    expect(launchRedirect("/tester/reprendre/abc")).toBe("/inscription");
    expect(launchRedirect("/tester/design")).toBe("/inscription");
    expect(launchRedirect("/cgu-test")).toBe("/cgu");
    expect(launchRedirect("/famille/visite-decouverte")).toBe("/famille/formule");
    expect(launchRedirect("/operateur/test")).toBe("/operateur");
    expect(launchRedirect("/testeur")).toBeNull();
    expect(launchRedirect("/famille")).toBeNull();
  });
});

describe("R2 : mentions légales obligatoires en production", () => {
  it("refuse un champ éditeur vide", () => {
    const p = productionConfigProblems(launchEnv({ EDITEUR_NOM: "", DIRECTEUR_PUBLICATION: " " }));
    expect(p).toContain("EDITEUR_NOM est vide (mentions légales obligatoires).");
    expect(p).toContain("DIRECTEUR_PUBLICATION est vide (mentions légales obligatoires).");
  });
});

describe("R1 : données réelles des aînés", () => {
  it("mode essai : toujours autorisées (données d'exemple)", () => {
    expect(realDataAllowedFrom({ NODE_ENV: "development" })).toBe(true);
  });
  it("lancement : fermées par défaut (préinscription)", () => {
    expect(realDataAllowedFrom(launchEnv())).toBe(false);
    expect(realDataAllowedFrom(launchEnv({ DONNEES_REELLES_AUTORISEES: "true" }))).toBe(false);
  });
  it("lancement : ouvertes seulement avec hébergeur HDS, date d'AIPD et contact DPO", () => {
    const full = { DONNEES_REELLES_AUTORISEES: "true", HEBERGEUR_HDS: "Clever Cloud HDS", AIPD_DATE: "2026-12-01", DPO_CONTACT: "dpo@koudmen.fr" };
    expect(realDataAllowedFrom(launchEnv(full))).toBe(true);
    expect(productionConfigProblems(launchEnv(full))).toEqual([]);
  });
  it("config-check refuse DONNEES_REELLES_AUTORISEES=true sans HDS, AIPD et DPO", () => {
    const p = productionConfigProblems(launchEnv({ DONNEES_REELLES_AUTORISEES: "true", AIPD_DATE: "2026-12-01" }));
    expect(p).toContain("DONNEES_REELLES_AUTORISEES=true exige HEBERGEUR_HDS.");
    expect(p).toContain("DONNEES_REELLES_AUTORISEES=true exige DPO_CONTACT.");
    expect(p).not.toContain("DONNEES_REELLES_AUTORISEES=true exige AIPD_DATE.");
  });
});

describe("L3 : e-mails et avertissements", () => {
  it("lit MAIL_FROM avec ou sans nom", () => {
    expect(parseMailFrom("Koudmen <bonjour@koudmen.fr>")).toEqual({ name: "Koudmen", email: "bonjour@koudmen.fr" });
    expect(parseMailFrom("bonjour@koudmen.fr")).toEqual({ name: "Koudmen", email: "bonjour@koudmen.fr" });
    expect(parseMailFrom("pas une adresse")).toBeNull();
    expect(productionConfigProblems(launchEnv({ MAIL_FROM: "pas une adresse" })).join(" ")).toContain("MAIL_FROM");
  });
  it("sans BREVO_API_KEY en lancement : avertissement, pas de refus (pas de page 503)", () => {
    expect(productionConfigProblems(launchEnv())).toEqual([]);
    expect(configWarnings(launchEnv()).join(" ")).toContain("BREVO_API_KEY absente");
    expect(configWarnings(launchEnv({ BREVO_API_KEY: "xkeysib-abc" })).join(" ")).not.toContain("BREVO_API_KEY absente");
  });
  it("signale le mode préinscription et le mode essai en production", () => {
    expect(configWarnings(launchEnv()).join(" ")).toContain("préinscription");
    expect(configWarnings(prodEnv()).join(" ")).toContain("Mode essai en production");
  });
});

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
