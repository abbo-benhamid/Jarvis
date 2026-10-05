import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Limites de débit sur une VRAIE base (opt-in) : KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/rate-limit.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("limites de débit en base", async () => {
  const { db } = await import("@/server/db");
  const rl = await import("./rate-limit");
  const subject = `test-${Date.now()}-${Math.random()}`;

  beforeEach(() => {
    delete process.env.RATE_LIMIT_DISABLED;
  });

  afterAll(async () => {
    await db.rateLimit.deleteMany({ where: { key: { contains: rl.subjectHash(subject) } } });
    await db.$disconnect();
  });

  it("bloque au-delà de la limite, puis rouvre après la fenêtre", async () => {
    const t0 = new Date("2026-10-05T10:00:00Z");
    const { limit, windowSeconds } = rl.RATE_RULES["avis:ip"];
    for (let i = 1; i <= limit; i++) {
      const r = await rl.hitRateLimit("avis:ip", subject, t0);
      expect(r).toMatchObject({ allowed: true, count: i });
    }
    const blocked = await rl.hitRateLimit("avis:ip", subject, new Date(t0.getTime() + 60_000));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(windowSeconds - 60);
    const later = await rl.hitRateLimit("avis:ip", subject, new Date(t0.getTime() + windowSeconds * 1000 + 1));
    expect(later).toMatchObject({ allowed: true, count: 1 });
  });

  it("compte juste sous la concurrence (20 essais simultanés)", async () => {
    const t = new Date();
    const results = await Promise.all(Array.from({ length: 20 }, () => rl.hitRateLimit("login:compte", subject, t)));
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(results.filter((r) => r.allowed)).toHaveLength(rl.RATE_RULES["login:compte"].limit);
  });

  it("ne stocke jamais le sujet en clair, et la purge efface les compteurs expirés", async () => {
    const rows = await db.rateLimit.findMany({ where: { key: { contains: rl.subjectHash(subject) } } });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.key).not.toContain(subject);
    await rl.purgeExpiredRateLimits(new Date(Date.now() + 2 * 86_400_000));
    expect(await db.rateLimit.count({ where: { key: { contains: rl.subjectHash(subject) } } })).toBe(0);
  });

  it("RATE_LIMIT_DISABLED coupe les limites hors production seulement", async () => {
    process.env.RATE_LIMIT_DISABLED = "true";
    expect(rl.rateLimitDisabled()).toBe(true);
    process.env.KOUDMEN_STRICT_CONFIG = "true";
    expect(rl.rateLimitDisabled()).toBe(false);
    delete process.env.KOUDMEN_STRICT_CONFIG;
  });
});
