#!/usr/bin/env node
/**
 * Produit les jetons de design à partir de design/tokens.json (ADR 0008 § 3.4).
 *
 * Usage (depuis la racine du dépôt) :
 *   node design/scripts/build-tokens.mjs              → réécrit le bloc généré de plateforme/src/app/globals.css
 *   node design/scripts/build-tokens.mjs --check      → échoue (code 1) si globals.css n'est pas à jour (CI)
 *   node design/scripts/build-tokens.mjs --ts <fichier> → écrit aussi un thème TypeScript (app mobile, lot M1)
 *
 * Le bloc CSS se trouve entre les marqueurs « @tokens:start » et « @tokens:end ».
 * Le reste de globals.css (base, focus, utilitaires) reste écrit à la main.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TOKENS = resolve(ROOT, "design/tokens.json");
const GLOBALS = resolve(ROOT, "plateforme/src/app/globals.css");
const START = "/* @tokens:start — généré par design/scripts/build-tokens.mjs depuis design/tokens.json. Ne pas modifier à la main. */";
const END = "/* @tokens:end */";

const tokens = JSON.parse(readFileSync(TOKENS, "utf8"));

/** Valeur brute d'un jeton : { value } ou chaîne. */
const v = (t) => (typeof t === "object" && t !== null ? t.value : t);
const isMeta = (k) => k.startsWith("$");
const entries = (o) => Object.entries(o).filter(([k]) => !isMeta(k));

function themeVars(mode) {
  const lines = [];
  for (const [k, t] of entries(tokens.color[mode])) lines.push(`--${k}: ${v(t)};`);
  for (const [k, t] of entries(tokens.illustration[mode])) lines.push(`--${k}: ${t};`);
  for (const [k, t] of entries(tokens.effect[mode])) lines.push(`--${k}: ${t};`);
  return lines;
}

function fontStack(key, nextFontVar) {
  const f = tokens.font[key];
  const fam = f.family.startsWith("ui-") ? f.family : `"${f.family}"`;
  // next/font fournit la variable ; sans elle (tests, outil externe), le nom de famille sert de repli.
  return [nextFontVar ? `var(${nextFontVar}, ${fam})` : fam, ...f.fallback].join(", ");
}

export function buildCss() {
  const indent = (arr, n) => arr.map((l) => " ".repeat(n) + l).join("\n");
  const light = themeVars("light");
  const dark = themeVars("dark");
  const m = tokens.motion;
  const L = tokens.layout;
  const shared = [
    "--madras: linear-gradient(90deg, var(--hibiscus) 0 28%, var(--soleil) 28% 52%, var(--mer) 52% 82%, var(--feuille) 82% 100%);",
    "--madras-ring: conic-gradient(var(--hibiscus) 0 25%, var(--soleil) 0 50%, var(--mer) 0 75%, var(--feuille) 0);",
    `--motion-fast: ${m.fast};`,
    `--motion-base: ${m.base};`,
    `--motion-slow: ${m.slow};`,
    `--motion-ease: ${m.easeOut};`,
    `--app-column: ${L.appColumn}px;`,
    `--content-max: ${L.contentMax}px;`,
    `--bottom-reserve: ${L.bottomReserve}px;`,
  ];
  const colorKeys = entries(tokens.color.light).map(([k]) => k).filter((k) => !k.startsWith("focus"));
  const bridge = [
    ...colorKeys.map((k) => `--color-${k}: var(--${k});`),
    `--font-sans: ${fontStack("sans", "--font-figtree")};`,
    `--font-display: ${fontStack("display", "--font-fraunces")};`,
    `--font-mono: ${fontStack("mono")};`,
    ...entries(tokens.radius)
      .filter(([k]) => k !== "pill")
      .map(([k, n]) => `--radius-${k}: ${n}px;`),
    "--shadow-card: var(--shadow);",
    "--shadow-float: var(--shadow-lg);",
    `--ease-out: ${m.easeOut};`,
    `--ease-in: ${m.easeIn};`,
  ];
  return [
    START,
    ":root {",
    indent([...light, ...shared, "color-scheme: light;"], 2),
    "}",
    "",
    "/* Sombre : suit le système, sauf choix manuel « clair » (data-theme sur <html>). */",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-theme="light"]) {',
    indent([...dark, "color-scheme: dark;"], 4),
    "  }",
    "}",
    "",
    ':root[data-theme="dark"] {',
    indent([...dark, "color-scheme: dark;"], 2),
    "}",
    "",
    "@theme inline {",
    indent(bridge, 2),
    "}",
    END,
  ].join("\n");
}

export function buildTs() {
  const pick = (mode) => Object.fromEntries(entries(tokens.color[mode]).map(([k, t]) => [k, v(t)]));
  const theme = {
    color: { light: pick("light"), dark: pick("dark") },
    illustration: { light: tokens.illustration.light, dark: tokens.illustration.dark },
    effect: tokens.effect,
    font: tokens.font,
    typeScale: Object.fromEntries(entries(tokens.typeScale)),
    radius: tokens.radius,
    space: tokens.space,
    layout: tokens.layout,
    motion: tokens.motion,
  };
  return [
    "// Fichier généré par design/scripts/build-tokens.mjs depuis design/tokens.json. Ne pas modifier à la main.",
    `export const tokens = ${JSON.stringify(theme, null, 2)} as const;`,
    "export type Tokens = typeof tokens;",
    "export type ColorName = keyof typeof tokens.color.light;",
    "",
  ].join("\n");
}

function splice(css, block) {
  const a = css.indexOf("/* @tokens:start");
  const b = css.indexOf(END);
  if (a === -1 || b === -1) throw new Error("Marqueurs @tokens:start / @tokens:end absents de globals.css.");
  return css.slice(0, a) + block + css.slice(b + END.length);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const current = readFileSync(GLOBALS, "utf8");
  const next = splice(current, buildCss());
  if (args.includes("--check")) {
    if (next !== current) {
      console.error("globals.css n'est pas à jour. Lancez : node design/scripts/build-tokens.mjs");
      process.exit(1);
    }
    console.log("Jetons à jour.");
  } else {
    if (next !== current) writeFileSync(GLOBALS, next);
    console.log(next !== current ? "globals.css mis à jour." : "globals.css déjà à jour.");
  }
  const ti = args.indexOf("--ts");
  if (ti !== -1) {
    const out = resolve(process.cwd(), args[ti + 1] ?? "");
    if (!args[ti + 1]) throw new Error("--ts demande un chemin de fichier.");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buildTs());
    console.log(`Thème TypeScript écrit : ${out}`);
  }
}
