import { createHash, randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { reponseCodeSchema, reponseErreurSchema, reponseJetonsSchema, reponseMoiSchema } from "../src/contracts/v1";
import { DEMO_PASSWORD, prisma } from "./fixtures";

/**
 * API v1 (lot A1, ADR 0008) : parcours de l'app accompagnant sur le compte de démo seedé.
 * connexion → GET /me → rotation → réutilisation détectée → déconnexion.
 * Le compte démo n'est pas modifié : la déconnexion ferme seulement la connexion de l'appareil.
 */
const DEMO_EMAIL = "accompagnant@demo.koudmen.test";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function login(request: APIRequestContext) {
  const { verifier, challenge } = pkce();
  const data = DEMO_PASSWORD
    ? { methode: "mot_de_passe", email: DEMO_EMAIL, motDePasse: DEMO_PASSWORD, codeChallenge: challenge }
    : { methode: "demo", role: "ACCOMPAGNANT", codeChallenge: challenge };
  const codeRes = await request.post("/api/v1/auth/code", { data });
  expect(codeRes.status()).toBe(200);
  const { code } = reponseCodeSchema.parse(await codeRes.json());
  const tokenRes = await request.post("/api/v1/auth/token", { data: { code, codeVerifier: verifier } });
  expect(tokenRes.status()).toBe(200);
  expect(tokenRes.headers()["cache-control"]).toContain("no-store");
  return { code, verifier, tokens: reponseJetonsSchema.parse(await tokenRes.json()) };
}

async function expectError(res: Awaited<ReturnType<APIRequestContext["get"]>>, status: number, code: string) {
  expect(res.status()).toBe(status);
  const body = reponseErreurSchema.parse(await res.json());
  expect(body.erreur.code).toBe(code);
}

test.describe("API v1 — authentification par jeton", () => {
  const start = new Date();

  test.afterAll(async () => {
    const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (demo) await prisma.refreshToken.deleteMany({ where: { userId: demo.id, createdAt: { gte: start } } });
    await prisma.$disconnect();
  });

  test("connexion accompagnant → /me → rotation → réutilisation détectée → déconnexion", async ({ request }) => {
    // 1. Connexion (code PKCE puis jetons). Le code ne sert qu'une fois.
    const { code, verifier, tokens: t1 } = await login(request);
    await expectError(await request.post("/api/v1/auth/token", { data: { code, codeVerifier: verifier } }), 400, "CODE_INVALIDE");
    // Le rejeu du code a fermé la connexion qu'il avait ouverte : on se reconnecte.
    const { tokens: t2 } = await login(request);

    // 2. /me : liste fermée de champs, aucune donnée de santé.
    const meRes = await request.get("/api/v1/me", { headers: { Authorization: `Bearer ${t2.jetonAcces}` } });
    expect(meRes.status()).toBe(200);
    const me = reponseMoiSchema.parse(await meRes.json());
    expect(me).toMatchObject({ role: "ACCOMPAGNANT", email: DEMO_EMAIL, demo: true, bacASable: false });
    const raw = JSON.stringify(me);
    for (const forbidden of ["besoin", "sante", "santé", "phone", "telephone", "passwordHash", "aine"]) expect(raw.toLowerCase()).not.toContain(forbidden.toLowerCase());
    expect(t1.jetonAcces).not.toBe(t2.jetonAcces);

    // 3. Rotation : nouveau couple de jetons, le nouveau jeton d'accès fonctionne.
    const r1 = await request.post("/api/v1/auth/refresh", { data: { jetonRenouvellement: t2.jetonRenouvellement } });
    expect(r1.status()).toBe(200);
    const t3 = reponseJetonsSchema.parse(await r1.json());
    expect(t3.jetonRenouvellement).not.toBe(t2.jetonRenouvellement);
    expect((await request.get("/api/v1/me", { headers: { Authorization: `Bearer ${t3.jetonAcces}` } })).status()).toBe(200);

    // 4. Réutilisation de l'ancien jeton : détectée, toute la famille est révoquée.
    await expectError(await request.post("/api/v1/auth/refresh", { data: { jetonRenouvellement: t2.jetonRenouvellement } }), 401, "JETON_REUTILISE");
    await expectError(await request.get("/api/v1/me", { headers: { Authorization: `Bearer ${t3.jetonAcces}` } }), 401, "NON_AUTHENTIFIE");
    await expectError(await request.post("/api/v1/auth/refresh", { data: { jetonRenouvellement: t3.jetonRenouvellement } }), 401, "JETON_INVALIDE");

    // 5. Nouvelle connexion, puis déconnexion : les deux jetons meurent.
    const { tokens: t4 } = await login(request);
    const out = await request.post("/api/v1/auth/logout", {
      headers: { Authorization: `Bearer ${t4.jetonAcces}` },
      data: { jetonRenouvellement: t4.jetonRenouvellement },
    });
    expect(out.status()).toBe(204);
    await expectError(await request.get("/api/v1/me", { headers: { Authorization: `Bearer ${t4.jetonAcces}` } }), 401, "NON_AUTHENTIFIE");
    await expectError(await request.post("/api/v1/auth/refresh", { data: { jetonRenouvellement: t4.jetonRenouvellement } }), 401, "JETON_INVALIDE");

    // En base : seulement des empreintes.
    const rows = await prisma.refreshToken.findMany({ where: { createdAt: { gte: start }, user: { email: DEMO_EMAIL } } });
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const r of rows) expect(r.tokenHash).not.toContain(t4.jetonRenouvellement.slice(4));
  });

  test("erreurs au format unique", async ({ request }) => {
    await expectError(await request.post("/api/v1/auth/code", { data: "{pas du json", headers: { "content-type": "application/json" } }), 400, "REQUETE_INVALIDE");
    const { challenge } = pkce();
    await expectError(
      await request.post("/api/v1/auth/code", { data: { methode: "mot_de_passe", email: DEMO_EMAIL, motDePasse: "mauvais-mot-de-passe", codeChallenge: challenge } }),
      401,
      "IDENTIFIANTS_INVALIDES",
    );
    await expectError(await request.get("/api/v1/me"), 401, "NON_AUTHENTIFIE");
    await expectError(await request.get("/api/v1/inconnue"), 404, "INTROUVABLE");
  });
});
