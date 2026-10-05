import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { pkceChallenge } from "./token";

/**
 * Service des jetons sur une VRAIE base (opt-in) : KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/auth/token-service.db.test.ts
 * Crée ses propres comptes (@token-test.koudmen.test) et les efface à la fin.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("service des jetons API v1 (base réelle)", async () => {
  process.env.SESSION_SECRET ||= "secret-de-test-pour-les-jetons-api-v1-0123456789";
  const { db } = await import("@/server/db");
  const svc = await import("./token-service");
  const DOMAIN = "token-test.koudmen.test";
  const PASSWORD = "mot-de-passe-de-test-123";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const verifier = randomBytes(32).toString("base64url");
  const challenge = pkceChallenge(verifier);
  let caregiverEmail = "";
  let caregiverId = "";

  async function makeUser(role: "ACCOMPAGNANT" | "OPERATEUR" | "FAMILLE", extra: { sandboxId?: string } = {}) {
    const email = `${role.toLowerCase()}-${run}-${randomBytes(2).toString("hex")}@${DOMAIN}`;
    const u = await db.user.create({
      data: { email, passwordHash: await bcrypt.hash(PASSWORD, 4), role, firstName: "Test", lastName: "Jeton", ...extra },
    });
    return u;
  }

  async function login(email = caregiverEmail) {
    const code = await svc.requestAuthCode({ methode: "mot_de_passe", email, motDePasse: PASSWORD, codeChallenge: challenge });
    if (!code.ok) throw new Error(code.code);
    const tokens = await svc.exchangeAuthCode(code.value.code, verifier);
    if (!tokens.ok) throw new Error(tokens.code);
    return { code: code.value.code, ...tokens.value };
  }

  beforeAll(async () => {
    const u = await makeUser("ACCOMPAGNANT");
    caregiverEmail = u.email;
    caregiverId = u.id;
  });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it("connexion → jetons → accès, avec empreinte seulement en base", async () => {
    const t = await login();
    expect(t.typeJeton).toBe("Bearer");
    const principal = await svc.authenticateAccessToken(t.jetonAcces);
    expect(principal?.user.id).toBe(caregiverId);
    const rows = await db.refreshToken.findMany({ where: { userId: caregiverId } });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(JSON.stringify(r)).not.toContain(t.jetonRenouvellement.slice(4));
  });

  it("mot de passe faux : même erreur que compte inconnu", async () => {
    const a = await svc.requestAuthCode({ methode: "mot_de_passe", email: caregiverEmail, motDePasse: "faux", codeChallenge: challenge });
    const b = await svc.requestAuthCode({ methode: "mot_de_passe", email: `inconnu-${run}@${DOMAIN}`, motDePasse: "faux", codeChallenge: challenge });
    expect(a).toEqual(b);
    expect(a).toMatchObject({ ok: false, code: "IDENTIFIANTS_INVALIDES" });
  });

  it("code : vérificateur PKCE faux refusé ; un code sert une seule fois et son rejeu ferme la connexion", async () => {
    const code = await svc.requestAuthCode({ methode: "mot_de_passe", email: caregiverEmail, motDePasse: PASSWORD, codeChallenge: challenge });
    if (!code.ok) throw new Error(code.code);
    expect(await svc.exchangeAuthCode(code.value.code, randomBytes(32).toString("base64url"))).toMatchObject({ ok: false, code: "CODE_INVALIDE" });
    const first = await svc.exchangeAuthCode(code.value.code, verifier);
    expect(first.ok).toBe(true);
    expect(await svc.exchangeAuthCode(code.value.code, verifier)).toMatchObject({ ok: false, code: "CODE_INVALIDE" });
    if (first.ok) expect(await svc.authenticateAccessToken(first.value.jetonAcces)).toBeNull();
  });

  it("rotation, puis réutilisation détectée : toute la famille est révoquée", async () => {
    const t1 = await login();
    const r2 = await svc.rotateRefreshToken(t1.jetonRenouvellement);
    if (!r2.ok) throw new Error(r2.code);
    expect(r2.value.jetonRenouvellement).not.toBe(t1.jetonRenouvellement);
    expect(await svc.authenticateAccessToken(r2.value.jetonAcces)).not.toBeNull();

    // Après le délai de grâce (X1, 30 s) : rejeu.
    const replay = await svc.rotateRefreshToken(t1.jetonRenouvellement, new Date(Date.now() + 31_000));
    expect(replay).toMatchObject({ ok: false, code: "JETON_REUTILISE" });
    // Le jeton le plus récent est mort aussi, et le jeton d'accès de la famille ne passe plus.
    expect(await svc.rotateRefreshToken(r2.value.jetonRenouvellement)).toMatchObject({ ok: false });
    expect(await svc.authenticateAccessToken(r2.value.jetonAcces)).toBeNull();
    const audit = await db.auditLog.count({ where: { actorId: caregiverId, action: "auth.api.refresh_reuse" } });
    expect(audit).toBeGreaterThan(0);
  });

  it("deux renouvellements simultanés : jamais deux jetons de renouvellement valides à la fois", async () => {
    const t = await login();
    const results = await Promise.all([svc.rotateRefreshToken(t.jetonRenouvellement), svc.rotateRefreshToken(t.jetonRenouvellement)]);
    expect(results.some((r) => r.ok)).toBe(results.filter((r) => r.ok).length > 0);
    const row = await db.refreshToken.findFirstOrThrow({ where: { userId: caregiverId }, orderBy: { createdAt: "desc" } });
    const live = await db.refreshToken.count({ where: { familyId: row.familyId, usedAt: null, revokedAt: null } });
    expect(live).toBeLessThanOrEqual(1);
  });

  it("X1 : réponse de /auth/refresh perdue → rejeu dans les 30 s = nouveau couple ; le successeur perdu est remplacé", async () => {
    const t1 = await login();
    const lost = await svc.rotateRefreshToken(t1.jetonRenouvellement);
    if (!lost.ok) throw new Error(lost.code);
    // L'app n'a jamais reçu `lost` ; elle rejoue t1 10 s plus tard.
    const again = await svc.rotateRefreshToken(t1.jetonRenouvellement, new Date(Date.now() + 10_000));
    if (!again.ok) throw new Error(again.code);
    expect(again.value.jetonRenouvellement).not.toBe(lost.value.jetonRenouvellement);
    expect(await svc.authenticateAccessToken(again.value.jetonAcces)).not.toBeNull();
    // Le nouveau couple sert normalement.
    const next = await svc.rotateRefreshToken(again.value.jetonRenouvellement);
    expect(next.ok).toBe(true);
    expect(await db.auditLog.count({ where: { actorId: caregiverId, action: "auth.api.refresh_grace" } })).toBeGreaterThan(0);
  });

  it("X1 : le successeur remplacé pendant la grâce qui revient quand même = rejeu, famille révoquée", async () => {
    const t1 = await login();
    const r2 = await svc.rotateRefreshToken(t1.jetonRenouvellement);
    if (!r2.ok) throw new Error(r2.code);
    const r3 = await svc.rotateRefreshToken(t1.jetonRenouvellement, new Date(Date.now() + 5_000));
    if (!r3.ok) throw new Error(r3.code);
    expect(await svc.rotateRefreshToken(r2.value.jetonRenouvellement)).toMatchObject({ ok: false, code: "JETON_REUTILISE" });
    expect(await svc.authenticateAccessToken(r3.value.jetonAcces)).toBeNull();
  });

  it("X1 : pas de grâce si le successeur a déjà servi (l'app l'avait reçu)", async () => {
    const t1 = await login();
    const r2 = await svc.rotateRefreshToken(t1.jetonRenouvellement);
    if (!r2.ok) throw new Error(r2.code);
    const r3 = await svc.rotateRefreshToken(r2.value.jetonRenouvellement);
    if (!r3.ok) throw new Error(r3.code);
    expect(await svc.rotateRefreshToken(t1.jetonRenouvellement, new Date(Date.now() + 5_000))).toMatchObject({ ok: false, code: "JETON_REUTILISE" });
    expect(await svc.authenticateAccessToken(r3.value.jetonAcces)).toBeNull();
  });

  it("jeton inconnu ou expiré refusé", async () => {
    expect(await svc.rotateRefreshToken("kr1_inconnu-inconnu-inconnu")).toMatchObject({ ok: false, code: "JETON_INVALIDE" });
    const t = await login();
    const later = new Date(Date.now() + 31 * 86_400_000);
    expect(await svc.rotateRefreshToken(t.jetonRenouvellement, later)).toMatchObject({ ok: false, code: "JETON_INVALIDE" });
  });

  it("lié à User.sessionVersion : la déconnexion web coupe l'app", async () => {
    const t = await login();
    await db.user.update({ where: { id: caregiverId }, data: { sessionVersion: { increment: 1 } } });
    expect(await svc.authenticateAccessToken(t.jetonAcces)).toBeNull();
    expect(await svc.rotateRefreshToken(t.jetonRenouvellement)).toMatchObject({ ok: false, code: "JETON_INVALIDE" });
  });

  it("déconnexion : révoque la famille ; « partout » ferme aussi les autres connexions", async () => {
    const a = await login();
    const b = await login();
    expect(await svc.logout({ accessToken: a.jetonAcces })).toBe(true);
    expect(await svc.authenticateAccessToken(a.jetonAcces)).toBeNull();
    expect(await svc.rotateRefreshToken(a.jetonRenouvellement)).toMatchObject({ ok: false });
    expect(await svc.authenticateAccessToken(b.jetonAcces)).not.toBeNull();

    expect(await svc.logout({ accessToken: null, refreshToken: b.jetonRenouvellement, partout: true })).toBe(true);
    expect(await svc.authenticateAccessToken(b.jetonAcces)).toBeNull();
    expect(await svc.logout({ accessToken: null, refreshToken: "kr1_inconnu-inconnu-inconnu" })).toBe(false);
  });

  it("X6 : compte démo partagé → « partout » ignoré : seul cet appareil est déconnecté, les autres visiteurs restent", async () => {
    const demo = await makeUser("FAMILLE");
    await db.user.update({ where: { id: demo.id }, data: { isDemo: true } });
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "true";
    try {
      const a = await login(demo.email);
      const b = await login(demo.email);
      expect(await svc.logout({ accessToken: a.jetonAcces, partout: true })).toBe(true);
      expect(await svc.authenticateAccessToken(a.jetonAcces)).toBeNull();
      expect(await svc.authenticateAccessToken(b.jetonAcces)).not.toBeNull();
      expect((await db.user.findUniqueOrThrow({ where: { id: demo.id } })).sessionVersion).toBe(0);
    } finally {
      process.env.DEMO_MODE = prev;
    }
  });

  it("refuse l'opérateur et le compte de bac à sable par mot de passe", async () => {
    const op = await makeUser("OPERATEUR");
    expect(await svc.requestAuthCode({ methode: "mot_de_passe", email: op.email, motDePasse: PASSWORD, codeChallenge: challenge })).toMatchObject({
      ok: false,
      code: "ACCES_REFUSE",
    });
    const sandbox = await db.sandbox.findFirst({ select: { id: true } });
    if (sandbox) {
      const sb = await makeUser("ACCOMPAGNANT", { sandboxId: sandbox.id });
      expect(await svc.requestAuthCode({ methode: "mot_de_passe", email: sb.email, motDePasse: PASSWORD, codeChallenge: challenge })).toMatchObject({
        ok: false,
        code: "ACCES_REFUSE",
      });
      await db.user.delete({ where: { id: sb.id } });
    }
  });

  it("compte démo refusé hors du mode démo", async () => {
    const before = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "false";
    try {
      expect(await svc.requestAuthCode({ methode: "demo", role: "ACCOMPAGNANT", codeChallenge: challenge })).toMatchObject({ ok: false, code: "ACCES_REFUSE" });
      expect(svc.apiAccessProblem({ role: "ACCOMPAGNANT", isDemo: true })).not.toBeNull();
    } finally {
      process.env.DEMO_MODE = before;
    }
  });

  it("purge : efface les jetons expirés depuis plus de 7 jours", async () => {
    const old = await db.refreshToken.create({
      data: {
        userId: caregiverId,
        familyId: `purge-${run}`,
        tokenHash: randomBytes(32).toString("hex"),
        sessionVersion: 0,
        expiresAt: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    const live = await login();
    expect(await svc.purgeRefreshTokens()).toBeGreaterThan(0);
    expect(await db.refreshToken.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await svc.authenticateAccessToken(live.jetonAcces)).not.toBeNull();
  });
});
