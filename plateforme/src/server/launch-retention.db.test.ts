import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * J29 : effacement des comptes jamais confirmés après 7 jours (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/launch-retention.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("purges du lancement (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const { purgeUnverifiedAccounts } = await import("./launch-retention");
  const DOMAIN = "retention-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const old = new Date(Date.now() - 8 * 86_400_000);
  const mk = (k: string, extra: object = {}) =>
    db.user.create({ data: { email: `${k}-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "R", lastName: "T", createdAt: old, ...extra } });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("efface un compte non confirmé de plus de 7 jours ; garde les comptes confirmés, récents et opérateurs", async () => {
    const stale = await mk("vieux");
    const verified = await mk("ok", { emailVerifiedAt: old });
    const recent = await mk("recent", { createdAt: new Date() });
    const op = await mk("op", { role: "OPERATEUR" });
    expect(await purgeUnverifiedAccounts()).toBeGreaterThanOrEqual(1);
    const left = await db.user.findMany({ where: { id: { in: [stale.id, verified.id, recent.id, op.id] } }, select: { id: true } });
    expect(left.map((u) => u.id).sort()).toEqual([verified.id, recent.id, op.id].sort());
  });
});
