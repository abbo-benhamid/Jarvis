import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * L2b (B1) : garde PERMANENTE. Toute écriture d'état d'un élément de vérification passe par `writeItemStatus`
 * (transition.ts), qui appelle `canTransition`. Ce test lit le code : un nouvel `verificationItem.update(...)`
 * ailleurs le fait échouer. Exceptions connues et justifiées :
 * - `accompagnant/service.ts` : `upsert` de création (A_FOURNIR) avec `update: {}` (aucun changement d'état) ;
 * - `sandbox/robots.ts` : robots du bac à sable (monde fictif, jamais le monde réel).
 */
const ROOT = join(__dirname, "..", "..");
const ALLOWED = new Set(["server/verifications/transition.ts", "server/accompagnant/service.ts", "server/sandbox/robots.ts"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("L2b B1 : une seule fonction écrit l'état d'un élément de vérification", () => {
  it("aucun verificationItem.update / updateMany / upsert hors des fichiers autorisés", () => {
    const offenders = files(ROOT)
      .filter((f) => /verificationItem\.(update|updateMany|upsert)\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
      .filter((f) => !ALLOWED.has(f));
    expect(offenders).toEqual([]);
  });
  it("writeItemStatus appelle canTransition et écrit sous condition d'état", () => {
    const src = readFileSync(join(ROOT, "server/verifications/transition.ts"), "utf8");
    expect(src).toMatch(/if \(!canTransition\(item\.status, to, by\)\)/);
    expect(src).toMatch(/where: \{ \.\.\.opts\.where, id: item\.id, status: item\.status \}/);
  });
  it("accompagnant/service.ts : l'upsert ne change jamais l'état (update vide)", () => {
    const src = readFileSync(join(ROOT, "server/accompagnant/service.ts"), "utf8");
    const upserts = src.match(/verificationItem\.upsert\(\{[\s\S]*?\}\);/g) ?? [];
    expect(upserts.length).toBe(1);
    expect(upserts[0]).toMatch(/update: \{\}/);
  });
});
