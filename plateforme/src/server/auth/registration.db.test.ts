import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { MailMessage, MailPort } from "@/server/mail/port";

/**
 * L2, L3 : inscription, vérification de l'e-mail, mot de passe oublié — sur une VRAIE base (opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/auth/registration.db.test.ts
 * Comptes @inscription-test.koudmen.test, effacés à la fin. E-mails capturés (aucun envoi).
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("inscription et liens par e-mail (base réelle)", async () => {
  process.env.SESSION_SECRET ||= "secret-de-test-pour-l-inscription-0123456789abcdef";
  process.env.APP_URL = "https://koudmen.test";
  const { db } = await import("@/server/db");
  const reg = await import("./registration");
  const tokens = await import("./account-tokens");
  const { setMailPortForTests } = await import("@/server/mail");
  const { verifyPassword } = await import("./password");

  const DOMAIN = "inscription-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const sent: MailMessage[] = [];
  const port: MailPort = { name: "console", send: async (m) => (sent.push(m), { ok: true, adapter: "console" }) };
  setMailPortForTests(port);

  const email = (k: string) => `${k}-${run}@${DOMAIN}`;
  const linkToken = (m: MailMessage) => decodeURIComponent(/jeton=([^\s&]+)/.exec(m.text)![1]!);
  const base = {
    firstName: "Rose",
    lastName: "Lafleur",
    password: "Zebre-Lagon-2026",
    phone: "+596 696 12 34 56",
    commune: "FORT_DE_FRANCE",
    location: null,
    city: null,
    birthDate: "1990-04-02",
    newsOptIn: false,
    via: "web" as const,
  };

  beforeEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    setMailPortForTests(null);
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { entityId: { in: users.map((u) => u.id) } } });
    await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db.$disconnect();
  });

  it("crée un accompagnant gratuit (aucun abonnement, aucun paiement) et envoie le lien de vérification", async () => {
    const r = await reg.registerAccount({ ...base, role: "ACCOMPAGNANT", email: email("rose"), newsOptIn: true });
    expect(r).toEqual({ ok: true });
    const u = await db.user.findUniqueOrThrow({
      where: { email: email("rose") },
      include: { caregiverProfile: true, subscriptionsPaid: true, accountTokens: true, activationRequests: true },
    });
    expect(u.emailVerifiedAt).toBeNull();
    expect(u.cguAcceptedAt).not.toBeNull();
    expect(u.newsOptInAt).not.toBeNull();
    expect(u.caregiverProfile).toMatchObject({ validation: "BROUILLON", communes: ["FORT_DE_FRANCE"] });
    expect(u.caregiverProfile!.birthDate!.toISOString().slice(0, 10)).toBe("1990-04-02");
    // R6 (J27) : l'inscription est gratuite pour l'accompagnant.
    expect(u.subscriptionsPaid).toHaveLength(0);
    expect(u.activationRequests).toHaveLength(0);
    // Jeton : empreinte seulement.
    expect(sent).toHaveLength(1);
    expect(sent[0]!.template).toBe("VERIFICATION_EMAIL");
    const token = linkToken(sent[0]!);
    expect(u.accountTokens).toHaveLength(1);
    expect(u.accountTokens[0]!.tokenHash).toBe(tokens.hashAccountToken(token));
    expect(JSON.stringify(u.accountTokens)).not.toContain(token);
    // Audit sans e-mail ni mot de passe.
    const audit = await db.auditLog.findMany({ where: { entityId: u.id } });
    expect(JSON.stringify(audit)).not.toMatch(new RegExp(`${run}|Zebre`));
  });

  it("refuse un accompagnant de moins de 18 ans et un mot de passe courant", async () => {
    const young = new Date();
    young.setUTCFullYear(young.getUTCFullYear() - 17);
    const r = await reg.registerAccount({ ...base, role: "ACCOMPAGNANT", email: email("jeune"), birthDate: young.toISOString().slice(0, 10) });
    expect(r).toMatchObject({ ok: false, field: "birthDate" });
    const r2 = await reg.registerAccount({ ...base, role: "ACCOMPAGNANT", email: email("courant"), password: "Martinique972" });
    expect(r2).toMatchObject({ ok: false, field: "password" });
    expect(await db.user.count({ where: { email: { in: [email("jeune"), email("courant")] } } })).toBe(0);
  });

  it("e-mail déjà connu : même résultat, aucun compte créé, e-mail « vous avez déjà un compte »", async () => {
    const r = await reg.registerAccount({ ...base, role: "FAMILLE", email: email("rose"), location: "HEXAGONE", commune: null, birthDate: null, firstName: "Autre" });
    expect(r).toEqual({ ok: true });
    expect(await db.user.count({ where: { email: email("rose") } })).toBe(1);
    expect(sent.map((m) => m.template)).toEqual(["COMPTE_EXISTANT"]);
    const u = await db.user.findUniqueOrThrow({ where: { email: email("rose") } });
    expect(u.firstName).toBe("Rose");
  });

  it("vérification de l'e-mail : lien à usage unique ; un nouveau lien annule l'ancien", async () => {
    await reg.registerAccount({ ...base, role: "FAMILLE", email: email("line"), location: "HEXAGONE", commune: null, birthDate: null, firstName: "Line" });
    const first = linkToken(sent[0]!);
    const u = await db.user.findUniqueOrThrow({ where: { email: email("line") } });
    await reg.resendVerification(u.id);
    const second = linkToken(sent[1]!);
    expect(await reg.verifyEmailToken(first)).toBe(false);
    expect(await reg.verifyEmailToken(second)).toBe(true);
    expect(await reg.verifyEmailToken(second)).toBe(false);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.emailVerifiedVia).toBe("LIEN");
    expect(await reg.resendVerification(u.id)).toBe(false);
  });

  it("le lien de vérification expire après 24 h", async () => {
    await reg.registerAccount({ ...base, role: "FAMILLE", email: email("tard"), location: "MARTINIQUE", commune: null, birthDate: null, firstName: "Tard" });
    const t = linkToken(sent[0]!);
    expect(await reg.verifyEmailToken(t, new Date(Date.now() + 24 * 3600_000 + 1000))).toBe(false);
    expect(await tokens.consumeAccountToken("kv1_faux", "VERIFICATION_EMAIL")).toEqual({ ok: false });
    expect(await tokens.consumeAccountToken(t, "MOT_DE_PASSE")).toEqual({ ok: false });
  });

  it("mot de passe oublié : rien pour un e-mail inconnu ; lien 1 h ; nouveau mot de passe ferme toutes les sessions", async () => {
    await reg.requestPasswordReset(email("personne"));
    expect(sent).toHaveLength(0);
    const u = await db.user.findUniqueOrThrow({ where: { email: email("rose") } });
    await db.refreshToken.create({ data: { userId: u.id, familyId: `f-${run}`, tokenHash: `h-${run}`, sessionVersion: u.sessionVersion, expiresAt: new Date(Date.now() + 3600_000) } });
    await reg.requestPasswordReset(email("rose"));
    expect(sent.map((m) => m.template)).toEqual(["MOT_DE_PASSE_OUBLIE"]);
    const t = linkToken(sent[0]!);
    expect(await reg.resetTokenValid(t)).toBe(true);
    expect(await reg.resetPassword(t, "motdepasse123")).toMatchObject({ ok: false, reason: "MOT_DE_PASSE" });
    expect(await reg.resetPassword(t, "Nouveau-Lagon-2027", new Date(Date.now() + 3600_000 + 1000))).toMatchObject({ ok: false, reason: "LIEN" });
    expect(await reg.resetPassword(t, "Nouveau-Lagon-2027")).toEqual({ ok: true });
    expect(await reg.resetPassword(t, "Encore-Autre-2028")).toMatchObject({ ok: false, reason: "LIEN" });
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id }, include: { refreshTokens: true } });
    expect(after.sessionVersion).toBe(u.sessionVersion + 1);
    expect(await verifyPassword("Nouveau-Lagon-2027", after.passwordHash)).toBe(true);
    expect(after.refreshTokens.every((r) => r.revokedAt !== null)).toBe(true);
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(sent.map((m) => m.template)).toContain("MOT_DE_PASSE_CHANGE");
  });

  it("D5 (code M4, sécu M4) : inscription avec l'e-mail d'un opérateur → aucun e-mail, aucun jeton ; resetPassword refuse l'opérateur", async () => {
    const op = await db.user.create({
      data: { email: email("operateur"), passwordHash: "x", role: "OPERATEUR", firstName: "Op", lastName: "Koudmen", emailVerifiedAt: new Date() },
    });
    const r = await reg.registerAccount({ ...base, role: "ACCOMPAGNANT", email: email("operateur") });
    expect(r).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    expect(await db.accountToken.count({ where: { userId: op.id } })).toBe(0);
    await reg.requestPasswordReset(email("operateur"));
    expect(sent).toHaveLength(0);
    // Un jeton créé par un autre chemin (ou ancien) ne change jamais le mot de passe d'un opérateur.
    const t = await tokens.issueAccountToken(op.id, "MOT_DE_PASSE");
    expect(await reg.resetPassword(t, "Nouveau-Lagon-2027")).toMatchObject({ ok: false, reason: "LIEN" });
    expect((await db.user.findUniqueOrThrow({ where: { id: op.id } })).passwordHash).toBe("x");
  });

  it("D6 : 3 e-mails au plus par 24 h vers une adresse, tous chemins confondus", async () => {
    await reg.registerAccount({ ...base, role: "FAMILLE", email: email("quota"), location: "HEXAGONE", commune: null, birthDate: null, firstName: "Quota" });
    const u = await db.user.findUniqueOrThrow({ where: { email: email("quota") } });
    expect(await reg.resendVerification(u.id)).toBe(true);
    await reg.requestPasswordReset(email("quota"));
    expect(sent).toHaveLength(3);
    // 4e envoi : rien ne part, quel que soit le chemin.
    expect(await reg.resendVerification(u.id)).toBe(false);
    await reg.requestPasswordReset(email("quota"));
    expect(await reg.registerAccount({ ...base, role: "FAMILLE", email: email("quota"), location: "HEXAGONE", commune: null, birthDate: null })).toEqual({ ok: true });
    expect(sent).toHaveLength(3);
    // Le lendemain, la fenêtre est rouverte.
    expect(await reg.resendVerification(u.id, new Date(Date.now() + 24 * 3600_000 + 60_000))).toBe(true);
    expect(sent).toHaveLength(4);
  });

  it("D5 : la branche « e-mail connu » applique la limite « mot de passe oublié » (3/h par e-mail)", async () => {
    const { hitRateLimit } = await import("@/server/rate-limit");
    const input = { ...base, role: "FAMILLE" as const, email: email("limite"), location: "HEXAGONE" as const, commune: null, birthDate: null };
    const t0 = new Date(Date.now() + 3 * 24 * 3600_000);
    await reg.registerAccount(input, t0);
    sent.length = 0;
    // Le lendemain (quota par adresse rouvert), 3 « mot de passe oublié » par le formulaire dans l'heure…
    const t1 = new Date(t0.getTime() + 25 * 3600_000);
    for (let i = 0; i < 3; i++) await hitRateLimit("mdp-oublie:compte", email("limite"), t1);
    // … puis une inscription avec le même e-mail : la limite par compte s'applique, aucun lien ne part.
    expect(await reg.registerAccount(input, t1)).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    // Une heure plus tard : le lien part de nouveau.
    expect(await reg.registerAccount(input, new Date(t1.getTime() + 3601_000))).toEqual({ ok: true });
    expect(sent.map((m) => m.template)).toEqual(["COMPTE_EXISTANT"]);
  });

  it("code m2 : deux inscriptions simultanées avec le même e-mail → deux réponses ok, un seul compte, pas de 500", async () => {
    const input = { ...base, role: "FAMILLE" as const, email: email("double"), location: "HEXAGONE" as const, commune: null, birthDate: null };
    const results = await Promise.all([reg.registerAccount(input), reg.registerAccount(input), reg.registerAccount(input)]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(await db.user.count({ where: { email: email("double") } })).toBe(1);
  });

  it("validation manuelle par l'opérateur : une fois, journalisée (J31)", async () => {
    await reg.registerAccount({ ...base, role: "FAMILLE", email: email("appel"), location: "HEXAGONE", commune: null, birthDate: null, firstName: "Appel" });
    const u = await db.user.findUniqueOrThrow({ where: { email: email("appel") } });
    const op = { id: u.id, role: "OPERATEUR" as const };
    expect(await reg.operatorVerifyEmail(op, u.id)).toBe(true);
    expect(await reg.operatorVerifyEmail(op, u.id)).toBe(false);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.emailVerifiedVia).toBe("OPERATEUR");
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: u.id, action: "auth.email_verified_manual" } });
    expect(log.metadata).toEqual({ methode: "APPEL" });
  });
});
