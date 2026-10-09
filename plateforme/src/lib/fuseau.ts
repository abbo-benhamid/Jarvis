/**
 * T1 (T4) : heures locales fondées sur le fuseau IANA du territoire. Fonctions PURES (client et serveur).
 * Aucun décalage en dur : Intl.DateTimeFormat donne le décalage exact à chaque instant (heure d'été comprise).
 */

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const CACHE = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
    CACHE.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Date et heure locales de `d` dans le fuseau `tz`. `weekday` : 0 = lundi … 6 = dimanche. */
export function localParts(d: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const x of formatter(tz).formatToParts(d)) p[x.type] = x.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday ?? ""] ?? 0,
  };
}

/** Décalage du fuseau par rapport à l'UTC, en minutes, à l'instant `d` (Guadeloupe : −240 ; Paris l'été : +120). */
export function offsetMinutes(d: Date, tz: string): number {
  const p = localParts(d, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(d.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

/**
 * Instant UTC d'une heure locale (année, mois 1-12, jour, heure, minute) dans le fuseau `tz`.
 * Heure qui n'existe pas (passage à l'heure d'été) : décalée vers l'avant. Heure double (retour) : la première.
 */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Décalages de la veille et du lendemain : couvrent un changement d'heure dans la journée.
  const before = guess - offsetMinutes(new Date(guess - 86_400_000), tz) * 60_000;
  const after = guess - offsetMinutes(new Date(guess + 86_400_000), tz) * 60_000;
  const matches = (t: number) => {
    const p = localParts(new Date(t), tz);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
  };
  const valid = [before, after].filter(matches);
  if (valid.length > 0) return new Date(Math.min(...valid));
  // Heure inexistante (avance de l'heure) : décalage d'avant le changement, donc plus tard en heure locale.
  return new Date(before);
}

/** Minuit local du jour qui contient `d`, exprimé en UTC. */
export function zonedMidnight(d: Date, tz: string): Date {
  const p = localParts(d, tz);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, tz);
}

/** Jour de la semaine local : 0 = lundi … 6 = dimanche. */
export function zonedDayOfWeek(d: Date, tz: string): number {
  return localParts(d, tz).weekday;
}

/** Jour local décalé de `n` jours (calendrier, pas 24 h : correct au changement d'heure). Renvoie l'année, le mois et le jour. */
export function addLocalDays(d: Date, n: number, tz: string): { year: number; month: number; day: number } {
  const p = localParts(d, tz);
  const x = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

/** « 9 h », « 14 h 30 » dans le fuseau `tz` (typographie française). */
export function hourIn(d: Date, tz: string): string {
  const p = localParts(d, tz);
  return p.minute === 0 ? `${p.hour} h` : `${p.hour} h ${String(p.minute).padStart(2, "0")}`;
}

/** Écart (heures, peut être décimal) entre deux fuseaux à l'instant `d` : heure de `b` − heure de `a`. */
export function hoursBetween(a: string, b: string, d: Date = new Date()): number {
  return (offsetMinutes(d, b) - offsetMinutes(d, a)) / 60;
}

/** Fuseau du lecteur (navigateur). Repli : `fallback`. */
export function readerTimeZone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}
