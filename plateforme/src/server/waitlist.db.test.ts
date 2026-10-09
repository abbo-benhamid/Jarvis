import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

const enabled = process.env.KOUDMEN_DB_TESTS === "1";

describe.runIf(enabled)("T1 : liste d'attente sur une vraie base", async () => {
  const { db } = await import("@/server/db");
  const { joinWaitlist, purgeWaitlist } = await import("./waitlist");
  const run = randomBytes(4).toString("hex");
  const email = (k: string) => `${k}-${run}@attente.koudmen.test`;
  const ip = () => `198.51.100.${Math.floor(Math.random() * 250)}-${run}-${randomBytes(3).toString("hex")}`;

  afterAll(async () => {
    await db.waitlistEntry.deleteMany({ where: { email: { endsWith: `-${run}@attente.koudmen.test` } } });
  });

  it("garde l'e-mail, le territoire et la preuve du consentement ; même résultat pour un doublon", async () => {
    expect(await joinWaitlist({ email: email("ana").toUpperCase(), territoire: "MARTINIQUE", ip: ip() })).toEqual({ ok: true });
    expect(await joinWaitlist({ email: email("ana"), territoire: "MARTINIQUE", ip: ip() })).toEqual({ ok: true });
    const rows = await db.waitlistEntry.findMany({ where: { email: email("ana") } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ territoire: "MARTINIQUE", consentVersion: "T1-2026-10" });
    expect(rows[0]!.consentText).toContain("12 mois");
  });

  it("territoire ouvert : rien n'est gardé, même réponse", async () => {
    expect(await joinWaitlist({ email: email("gp"), territoire: "GUADELOUPE", ip: ip() })).toEqual({ ok: true });
    expect(await db.waitlistEntry.count({ where: { email: email("gp") } })).toBe(0);
  });

  it("limite par IP : 429 au 6e essai ; limite par e-mail : silencieuse", async () => {
    const same = ip();
    for (let i = 0; i < 5; i++) expect((await joinWaitlist({ email: email(`ip${i}`), territoire: "GUYANE", ip: same })).ok).toBe(true);
    expect(await joinWaitlist({ email: email("ip6"), territoire: "GUYANE", ip: same })).toMatchObject({ ok: false, reason: "TROP_DE_REQUETES" });
    for (let i = 0; i < 3; i++) await joinWaitlist({ email: email("bob"), territoire: "HEXAGONE", ip: ip() });
    // 4e essai pour cet e-mail : même réponse, rien n'est écrit (Guyane jamais demandée avant).
    expect(await joinWaitlist({ email: email("bob"), territoire: "GUYANE", ip: ip() })).toEqual({ ok: true });
    expect(await db.waitlistEntry.count({ where: { email: email("bob"), territoire: "GUYANE" } })).toBe(0);
  });

  it("purge : efface les inscriptions de plus de 12 mois", async () => {
    await db.waitlistEntry.create({
      data: { email: email("vieux"), territoire: "GUYANE", consentText: "x", consentVersion: "x", consentAt: new Date("2025-01-01"), createdAt: new Date("2025-01-01") },
    });
    const n = await purgeWaitlist(new Date("2026-10-09T00:00:00Z"));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await db.waitlistEntry.count({ where: { email: email("vieux") } })).toBe(0);
    expect(await db.waitlistEntry.count({ where: { email: email("ana") } })).toBe(1);
  });
});
