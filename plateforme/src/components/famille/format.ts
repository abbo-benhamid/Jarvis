import { DEFAULT_TZ } from "@/lib/format";

/**
 * Dates courtes des espaces famille et accompagnant. Utilisable client et serveur.
 * T1 (T4) : fuseau du territoire de l'aîné (paramètre `tz`) ; par défaut, le territoire de lancement (Guadeloupe).
 */

const CACHE = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${locale}|${JSON.stringify(opts)}`;
  let f = CACHE.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts });
    CACHE.set(key, f);
  }
  return f;
}
const fr = (tz: string, opts: Intl.DateTimeFormatOptions) => fmt(tz, "fr-FR", opts);
const dayKey = (d: Date, tz: string) => fmt(tz, "en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
}

/** « 1er » au lieu de « 1 » en début de jour du mois (S1b-ux m7). */
function firstOfMonth(s: string): string {
  return s.replace(/(^|\s)1 (?=\p{L})/u, "$11er ");
}

/** « Jeu » (pavé de date). */
export function weekdayShort(d: Date, tz: string = DEFAULT_TZ): string {
  return capitalize(fr(tz, { weekday: "short" }).format(d).replace(/\.$/, ""));
}

/** « 8 » (pavé de date). */
export function dayNumber(d: Date, tz: string = DEFAULT_TZ): string {
  return fr(tz, { day: "numeric" }).format(d);
}

/** « jeudi 8 octobre ». */
export function dayLong(d: Date, tz: string = DEFAULT_TZ): string {
  return firstOfMonth(fr(tz, { weekday: "long", day: "numeric", month: "long" }).format(d));
}

/** « samedi 3 oct. ». */
export function dayShort(d: Date, tz: string = DEFAULT_TZ): string {
  return firstOfMonth(fr(tz, { weekday: "long", day: "numeric", month: "short" }).format(d));
}

/** « 10 h » ou « 10 h 30 » (typographie française, espace insécable). */
export function hourLabel(d: Date, tz: string = DEFAULT_TZ): string {
  const [h, m] = fr(tz, { hour: "numeric", minute: "2-digit" }).format(d).split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

/** « aujourd'hui », « hier », « samedi » (moins de 7 jours), sinon « 3 oct. ». */
export function relativeDay(d: Date, now: Date = new Date(), tz: string = DEFAULT_TZ): string {
  const days = Math.round((Date.parse(dayKey(now, tz)) - Date.parse(dayKey(d, tz))) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days > 1 && days < 7) return fr(tz, { weekday: "long" }).format(d);
  return dayShort(d, tz).replace(/^\p{L}+ /u, "");
}
