import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ADR 0008 § 3.4 : globals.css doit refléter design/tokens.json (source unique web + mobile).
const script = resolve(__dirname, "../../../../design/scripts/build-tokens.mjs");

describe.runIf(existsSync(script))("jetons de design", () => {
  it("globals.css est à jour avec design/tokens.json", () => {
    const r = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });
});
