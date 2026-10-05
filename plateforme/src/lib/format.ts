/** Formatage FR, fuseau de la Martinique par défaut. Utilisable client et serveur. */
export const MARTINIQUE_TZ = "America/Martinique";

export function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** « 1er octobre 2026 » (et non « 1 octobre 2026 ») : S1b-ux m7. */
export function formatDate(d: Date | string, tz = MARTINIQUE_TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: tz }).format(new Date(d)).replace(/^1 /, "1er ");
}

export function formatDateTime(d: Date | string, tz = MARTINIQUE_TZ): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  }).format(new Date(d));
}

export function formatTime(d: Date | string, tz = MARTINIQUE_TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: tz }).format(new Date(d));
}

/** « de Léonie », « d'Ernest » : élision devant une voyelle ou un h muet (S1b-ux m7). */
export function deName(name: string): string {
  return /^[aeiouyhâàéèêëîïôöûüœ]/i.test(name.trim()) ? `d'${name}` : `de ${name}`;
}

/** Initiale du nom avec UN seul point (« B. », jamais « B.. »). */
export function initialWithDot(initial: string | null | undefined): string {
  const clean = (initial ?? "").trim().replace(/\.+$/, "");
  return clean ? `${clean}.` : "";
}

export function fullName(u: { firstName: string; lastName?: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}
