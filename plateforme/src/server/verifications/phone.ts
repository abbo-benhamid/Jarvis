/**
 * L2 (étude § 5.1) : numéros acceptés. Fonctions PURES.
 * On normalise toujours en E.164. « +696 » n'est pas un indicatif : 0696 12 34 56 → +596 696 12 34 56.
 * Tout autre pays est refusé en V1.1 (fraude au SMS surtaxé).
 */

export type Territoire = "MARTINIQUE" | "GUADELOUPE" | "GUYANE" | "REUNION_MAYOTTE" | "HEXAGONE";

type PrefixRule = { prefix: string; territoire: Territoire; mobile: boolean };

/** Préfixes E.164 acceptés. Une ligne fixe reçoit seulement l'appel vocal. */
export const PHONE_PREFIXES: readonly PrefixRule[] = [
  { prefix: "+596696", territoire: "MARTINIQUE", mobile: true },
  { prefix: "+596697", territoire: "MARTINIQUE", mobile: true },
  { prefix: "+596596", territoire: "MARTINIQUE", mobile: false },
  { prefix: "+590690", territoire: "GUADELOUPE", mobile: true },
  { prefix: "+590691", territoire: "GUADELOUPE", mobile: true },
  { prefix: "+590590", territoire: "GUADELOUPE", mobile: false },
  // [À VÉRIFIER] +594695 (nouvelle tranche mobile de Guyane).
  { prefix: "+594694", territoire: "GUYANE", mobile: true },
  { prefix: "+594594", territoire: "GUYANE", mobile: false },
  { prefix: "+262692", territoire: "REUNION_MAYOTTE", mobile: true },
  { prefix: "+262693", territoire: "REUNION_MAYOTTE", mobile: true },
  { prefix: "+262639", territoire: "REUNION_MAYOTTE", mobile: true },
  { prefix: "+262262", territoire: "REUNION_MAYOTTE", mobile: false },
  { prefix: "+262269", territoire: "REUNION_MAYOTTE", mobile: false },
  { prefix: "+336", territoire: "HEXAGONE", mobile: true },
  { prefix: "+337", territoire: "HEXAGONE", mobile: true },
  { prefix: "+331", territoire: "HEXAGONE", mobile: false },
  { prefix: "+332", territoire: "HEXAGONE", mobile: false },
  { prefix: "+333", territoire: "HEXAGONE", mobile: false },
  { prefix: "+334", territoire: "HEXAGONE", mobile: false },
  { prefix: "+335", territoire: "HEXAGONE", mobile: false },
  { prefix: "+339", territoire: "HEXAGONE", mobile: false },
];

/** Numérotation nationale (0 + 9 chiffres) → indicatif du territoire. */
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
 * `PHONE_ALLOWED_PREFIXES` (facultatif) : liste de préfixes E.164 séparés par des virgules. Elle RÉDUIT la liste par défaut.
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

/** « +596696123456 » → « +596 696 12 34 56 ». */
export function formatPhone(e164: string): string {
  const cc = countryCodeLength(e164);
  const head = e164.slice(0, cc + 1);
  const rest = e164.slice(cc + 1);
  if (cc === 2) return `${head} ${rest.slice(0, 1)} ${rest.slice(1).match(/.{1,2}/g)?.join(" ") ?? ""}`.trim();
  return `${head} ${rest.slice(0, 3)} ${rest.slice(3).match(/.{1,2}/g)?.join(" ") ?? ""}`.trim();
}

/** « +596 696 •• •• 56 » : assez pour reconnaître son numéro, pas assez pour le lire. */
export function maskPhone(e164: string): string {
  const parts = formatPhone(e164).split(" ");
  return parts.map((p, i) => (i >= 2 && i < parts.length - 1 ? "••" : p)).join(" ");
}

/** Messages STE pour l'accompagnant. */
export const PHONE_MESSAGES = {
  FORMAT: "Ce numéro n'est pas valide. Exemple : 0696 12 34 56.",
  PREFIXE: "Koudmen accepte les numéros de Martinique, de Guadeloupe, de Guyane, de La Réunion, de Mayotte et de l'Hexagone.",
  FIXE: "Ce numéro est une ligne fixe. Elle ne reçoit pas de SMS. Choisissez « Recevoir un appel ».",
} as const;
