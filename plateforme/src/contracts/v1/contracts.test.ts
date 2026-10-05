import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CODES_ERREUR,
  STATUT_HTTP,
  demandeCodeSchema,
  demandeDeconnexionSchema,
  demandeJetonSchema,
  demandeRenouvellementSchema,
  reponseErreurSchema,
  reponseJetonsSchema,
  reponseMoiSchema,
} from "./index";

const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"; // RFC 7636, annexe B
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

describe("contrats v1 : portabilité (copiés tels quels dans l'app mobile)", () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("n'importe que zod et les fichiers du dossier", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      const imports = [...src.matchAll(/(?:import|export)[^"']*from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const spec of imports) {
        expect(spec === "zod" || /^\.\/[a-z-]+$/.test(spec), `${f} importe ${spec}`).toBe(true);
      }
      expect(src).not.toMatch(/server-only|@prisma|@\/|process\.env|node:/);
    }
  });
});

describe("contrats v1 : erreurs", () => {
  it("chaque code a un statut HTTP", () => {
    for (const c of CODES_ERREUR) expect(STATUT_HTTP[c]).toBeGreaterThanOrEqual(400);
  });

  it("accepte le format unique et refuse un champ en plus", () => {
    expect(reponseErreurSchema.safeParse({ erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous." } }).success).toBe(true);
    expect(reponseErreurSchema.safeParse({ erreur: { code: "INCONNU", message: "x" } }).success).toBe(false);
    expect(reponseErreurSchema.safeParse({ erreur: { code: "NON_AUTHENTIFIE", message: "x", pile: "…" } }).success).toBe(false);
    expect(reponseErreurSchema.safeParse({ error: { code: "NON_AUTHENTIFIE", message: "x" } }).success).toBe(false);
  });
});

describe("contrats v1 : authentification", () => {
  it("demande de code par mot de passe : normalise l'e-mail", () => {
    const r = demandeCodeSchema.parse({ methode: "mot_de_passe", email: "  Josiane@Exemple.TEST ", motDePasse: "x", codeChallenge: CHALLENGE });
    expect(r).toMatchObject({ methode: "mot_de_passe", email: "josiane@exemple.test" });
  });

  it("refuse un défi PKCE mal formé, un champ inconnu, un rôle opérateur en démo", () => {
    expect(demandeCodeSchema.safeParse({ methode: "demo", role: "ACCOMPAGNANT", codeChallenge: "court" }).success).toBe(false);
    expect(demandeCodeSchema.safeParse({ methode: "demo", role: "OPERATEUR", codeChallenge: CHALLENGE }).success).toBe(false);
    expect(demandeCodeSchema.safeParse({ methode: "demo", role: "ACCOMPAGNANT", codeChallenge: CHALLENGE, admin: true }).success).toBe(false);
    expect(demandeCodeSchema.safeParse({ methode: "sms", codeChallenge: CHALLENGE }).success).toBe(false);
    expect(demandeCodeSchema.safeParse({ methode: "demo", role: "ACCOMPAGNANT", codeChallenge: `${CHALLENGE.slice(0, 42)}+` }).success).toBe(false);
  });

  it("échange de code : vérificateur de 43 à 128 caractères base64url", () => {
    const code = "x".repeat(40);
    expect(demandeJetonSchema.safeParse({ code, codeVerifier: VERIFIER }).success).toBe(true);
    expect(demandeJetonSchema.safeParse({ code, codeVerifier: "a".repeat(42) }).success).toBe(false);
    expect(demandeJetonSchema.safeParse({ code, codeVerifier: "a".repeat(129) }).success).toBe(false);
    expect(demandeJetonSchema.safeParse({ code, codeVerifier: `${"a".repeat(42)}=` }).success).toBe(false);
  });

  it("réponse de jetons, renouvellement, déconnexion", () => {
    const jetons = {
      typeJeton: "Bearer",
      jetonAcces: "a".repeat(100),
      expireDans: 900,
      jetonRenouvellement: "kr1_".concat("b".repeat(43)),
      renouvellementExpireDans: 2_592_000,
    };
    expect(reponseJetonsSchema.safeParse(jetons).success).toBe(true);
    expect(reponseJetonsSchema.safeParse({ ...jetons, typeJeton: "MAC" }).success).toBe(false);
    expect(demandeRenouvellementSchema.safeParse({ jetonRenouvellement: jetons.jetonRenouvellement }).success).toBe(true);
    expect(demandeRenouvellementSchema.safeParse({}).success).toBe(false);
    expect(demandeDeconnexionSchema.safeParse({}).success).toBe(true);
    expect(demandeDeconnexionSchema.safeParse({ partout: "oui" }).success).toBe(false);
  });
});

describe("contrats v1 : /me", () => {
  const moi = { id: "u1", role: "ACCOMPAGNANT", prenom: "Josiane", nom: "R.", email: "j@exemple.test", demo: true, bacASable: false };

  it("accepte le profil minimal", () => {
    expect(reponseMoiSchema.safeParse(moi).success).toBe(true);
  });

  it("refuse tout champ en plus (aucune donnée de santé, aucun téléphone)", () => {
    for (const extra of [{ besoins: ["MEMOIRE"] }, { phone: "+596…" }, { passwordHash: "x" }, { aines: [] }]) {
      expect(reponseMoiSchema.safeParse({ ...moi, ...extra }).success).toBe(false);
    }
  });
});
