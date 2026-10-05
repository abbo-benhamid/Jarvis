import { MARTINIQUE_TZ } from "@/lib/format";

/** Dates courtes de l'espace famille (fuseau de la Martinique). Utilisable client et serveur. */

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: MARTINIQUE_TZ, ...opts });
const WEEKDAY_SHORT = fmt({ weekday: "short" });
const DAY_NUMBER = fmt({ day: "numeric" });
const WEEKDAY_LONG = fmt({ weekday: "long" });
const DAY_MONTH_LONG = fmt({ weekday: "long", day: "numeric", month: "long" });
const DAY_MONTH_SHORT = fmt({ weekday: "long", day: "numeric", month: "short" });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: MARTINIQUE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const HOUR = fmt({ hour: "numeric", minute: "2-digit" });

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
}

/** « 1er » au lieu de « 1 » en début de jour du mois (S1b-ux m7). */
function firstOfMonth(s: string): string {
  return s.replace(/(^|\s)1 (?=\p{L})/u, "$11er ");
}

/** « Jeu » (pavé de date). */
export function weekdayShort(d: Date): string {
  return capitalize(WEEKDAY_SHORT.format(d).replace(/\.$/, ""));
}

/** « 8 » (pavé de date). */
export function dayNumber(d: Date): string {
  return DAY_NUMBER.format(d);
}

/** « jeudi 8 octobre ». */
export function dayLong(d: Date): string {
  return firstOfMonth(DAY_MONTH_LONG.format(d));
}

/** « samedi 3 oct. ». */
export function dayShort(d: Date): string {
  return firstOfMonth(DAY_MONTH_SHORT.format(d));
}

/** « 10 h » ou « 10 h 30 » (typographie française, espace insécable). */
export function hourLabel(d: Date): string {
  const [h, m] = HOUR.format(d).split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

/** « aujourd'hui », « hier », « samedi » (moins de 7 jours), sinon « 3 oct. ». */
export function relativeDay(d: Date, now: Date = new Date()): string {
  const days = Math.round((Date.parse(DAY_KEY.format(now)) - Date.parse(DAY_KEY.format(d))) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days > 1 && days < 7) return WEEKDAY_LONG.format(d);
  return dayShort(d).replace(/^\p{L}+ /u, "");
}
