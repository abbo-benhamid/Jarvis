/** Formatage FR, fuseau de la Martinique par défaut. Utilisable client et serveur. */
export const MARTINIQUE_TZ = "America/Martinique";

export function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatDate(d: Date | string, tz = MARTINIQUE_TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: tz }).format(new Date(d));
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

export function fullName(u: { firstName: string; lastName?: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}
