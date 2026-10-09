/**
 * L2 (étude § 5.1) et T1 (T5) : numéros acceptés. Fonctions PURES.
 * On normalise toujours en E.164. « +690 » n'est pas un indicatif : 0690 12 34 56 → +590 690 12 34 56.
 * Préfixes : ceux des 4 territoires de `src/lib/territoires.ts` (Guadeloupe, Martinique, Guyane, Hexagone).
 * Tout autre pays ou territoire est refusé (fraude au SMS surtaxé).
 */
import { TERRITOIRES, TERRITOIRES_CONFIG, TERRITOIRE_LANCEMENT, type CodeTerritoire } from "@/lib/territoires";

export type Territoire = CodeTerritoire;

type PrefixRule = { prefix: string; territoire: Territoire; mobile: boolean };

/** Préfixes E.164 acceptés (T5). Une ligne fixe reçoit seulement l'appel vocal. */
export const PHONE_PREFIXES: readonly PrefixRule[] = TERRITOIRES.flatMap((t) => [
  ...TERRITOIRES_CONFIG[t].prefixesMobiles.map((prefix) => ({ prefix, territoire: t, mobile: true })),
  ...TERRITOIRES_CONFIG[t].prefixesFixes.map((prefix) => ({ prefix, territoire: t, mobile: false })),
]);

/**
 * Numérotation nationale (0 + 9 chiffres) → indicatif. L'ordre compte : l'outre-mer avant l'Hexagone.
 * La Réunion et Mayotte (+262) restent ici pour être REFUSÉES (PREFIXE) et non prises pour un fixe de l'Hexagone.
 * [À VÉRIFIER] 0695 (nouvelle tranche mobile de Guyane) : converti en +594, mais pas encore accepté.
 */
const NATIONAL: [RegExp, string][] = [
  [/^0(696|697|596)/, "+596"],
  [/^0(690|691|590)/, "+590"],
  [/^0(694|695|594)/, "+594"],
  [/^0(692|693|639|262|269)/, "+262"],
  [/^0[1-9]/, "+33"],
];

export type PhoneResult =
  | { ok: true; e164: string; territoire: Territoire; mobile: boolean }
  | { ok: false; reason: "FORMAT" | "PREFIXE" };

/**
 * `PHONE_ALLOWED_PREFIXES` (facultatif) : liste de préfixes E.164 séparés par des virgules. Elle RÉDUIT la liste par
 * défaut (les 4 territoires). Exemple : « +590 » = Guadeloupe seulement. Vide = les 4 territoires.
 */
export function allowedPrefixes(env: Record<string, string | undefined> = process.env): readonly PrefixRule[] {
  const raw = env.PHONE_ALLOWED_PREFIXES?.trim();
  if (!raw) return PHONE_PREFIXES;
  const wanted = raw.split(",").map((p) => p.trim()).filter(Boolean);
  return PHONE_PREFIXES.filter((r) => wanted.some((w) => r.prefix.startsWith(w) || w.startsWith(r.prefix)));
}

export function normalizePhone(raw: string, rules: readonly PrefixRule[] = PHONE_PREFIXES): PhoneResult {
  let v = raw.replace(/[\s().-]/g, "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (!/^\+?\d{9,15}$/.test(v)) return { ok: false, reason: "FORMAT" };
  let e164: string | null = null;
  if (v.startsWith("+")) e164 = v;
  else if (/^0\d{9}$/.test(v)) {
    const hit = NATIONAL.find(([re]) => re.test(v));
    if (hit) e164 = `${hit[1]}${v.slice(1)}`;
  }
  if (!e164) return { ok: false, reason: "FORMAT" };
  // France : +33 + 9 chiffres. Outre-mer : +59x / +262 + 9 chiffres.
  const lengthOk = e164.startsWith("+33") ? e164.length === 12 : e164.length === 13;
  const rule = rules.find((r) => e164!.startsWith(r.prefix));
  if (!rule) return { ok: false, reason: "PREFIXE" };
  if (!lengthOk) return { ok: false, reason: "FORMAT" };
  return { ok: true, e164, territoire: rule.territoire, mobile: rule.mobile };
}

function countryCodeLength(e164: string): number {
  return e164.startsWith("+33") ? 2 : 3;
}

/** « +590690123456 » → « +590 690 12 34 56 ». */
export function formatPhone(e164: string): string {
  const cc = countryCodeLength(e164);
  const head = e164.slice(0, cc + 1);
  const rest = e164.slice(cc + 1);
  if (cc === 2) return `${head} ${rest.slice(0, 1)} ${rest.slice(1).match(/.{1,2}/g)?.join(" ") ?? ""}`.trim();
  return `${head} ${rest.slice(0, 3)} ${rest.slice(3).match(/.{1,2}/g)?.join(" ") ?? ""}`.trim();
}

/** « +590 690 •• •• 56 » : assez pour reconnaître son numéro, pas assez pour le lire. */
export function maskPhone(e164: string): string {
  const parts = formatPhone(e164).split(" ");
  return parts.map((p, i) => (i >= 2 && i < parts.length - 1 ? "••" : p)).join(" ");
}

/** « de Guadeloupe », « de Martinique », « de Guyane », « de l'Hexagone ». */
const deNoms = TERRITOIRES.map((t) => TERRITOIRES_CONFIG[t].deNom);

/** Messages STE pour l'accompagnant. */
export const PHONE_MESSAGES = {
  FORMAT: `Ce numéro n'est pas valide. Exemple : ${TERRITOIRES_CONFIG[TERRITOIRE_LANCEMENT].exempleTelephone}.`,
  PREFIXE: `Koudmen accepte les numéros ${deNoms.slice(0, -1).join(", ")} et ${deNoms.at(-1)}.`,
  FIXE: "Ce numéro est une ligne fixe. Elle ne reçoit pas de SMS. Choisissez « Recevoir un appel ».",
} as const;
