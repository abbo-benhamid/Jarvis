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
