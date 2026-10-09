/**
 * Planification des visites d'une mission (Lot B). Fonctions PURES.
 * Règle : à l'acceptation, Koudmen crée les visites des 4 prochaines semaines.
 * T1 (T4) : les créneaux sont des heures LOCALES du territoire de l'aîné (fuseau IANA). Aucun décalage en dur :
 * Guadeloupe et Martinique (UTC − 4), Guyane (UTC − 3), Hexagone (UTC + 1 / + 2, heure d'été comprise).
 */
import type { Frequency, TimeSlot } from "@prisma/client";
import { addLocalDays, zonedDayOfWeek, zonedMidnight, zonedToUtc } from "@/lib/fuseau";

export const PLANNING_WEEKS = 4;

/** Heure de début (heure locale du territoire) de chaque créneau. */
export const SLOT_START_HOUR: Record<TimeSlot, number> = {
  MATIN: 9,
  APRES_MIDI: 14,
  SOIR: 18,
};

/** Nombre maximal de visites par semaine selon la fréquence. */
const MAX_PER_WEEK: Record<Frequency, number> = {
  PONCTUELLE: 1,
  HEBDOMADAIRE: 1,
  DEUX_PAR_SEMAINE: 2,
  QUOTIDIENNE: 7,
};

export type PlanInput = {
  frequency: Frequency;
  durationMinutes: number;
  startDate: Date | null;
  /** 0 = lundi … 6 = dimanche. */
  slots: { dayOfWeek: number; slot: TimeSlot }[];
  /** Fuseau IANA du territoire de l'aîné (ex. « America/Guadeloupe »). */
  timeZone: string;
};

export type PlannedVisit = { scheduledStart: Date; scheduledEnd: Date };

/** Minuit local (fuseau `tz`) du jour qui contient `d`, exprimé en UTC. */
export function localMidnight(d: Date, tz: string): Date {
  return zonedMidnight(d, tz);
}

/** Jour de la semaine local : 0 = lundi … 6 = dimanche. */
export function localDayOfWeek(d: Date, tz: string): number {
  return zonedDayOfWeek(d, tz);
}

function slotsOrDefault(input: PlanInput, firstDay: Date): { dayOfWeek: number; slot: TimeSlot }[] {
  if (input.slots.length > 0) return input.slots;
  const d0 = localDayOfWeek(firstDay, input.timeZone);
  switch (input.frequency) {
    case "QUOTIDIENNE":
      return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, slot: "MATIN" as const }));
    case "DEUX_PAR_SEMAINE":
      return [
        { dayOfWeek: d0, slot: "MATIN" },
        { dayOfWeek: (d0 + 3) % 7, slot: "MATIN" },
      ];
    default:
      return [{ dayOfWeek: d0, slot: "MATIN" }];
  }
}

/**
 * Visites des 4 prochaines semaines.
 * - Fenêtre : du plus tard entre `now` et la date de début, sur 28 jours (jours du calendrier local).
 * - Une visite par créneau demandé, dans la limite de la fréquence (par bloc de 7 jours).
 * - Ponctuelle : une seule visite.
 * - Aucune visite dans le passé.
 */
export function planVisits(input: PlanInput, now: Date = new Date()): PlannedVisit[] {
  const tz = input.timeZone;
  const from = input.startDate && input.startDate.getTime() > now.getTime() ? input.startDate : now;
  const firstDay = localMidnight(from, tz);
  const slots = slotsOrDefault(input, firstDay);
  const duration = Math.max(15, input.durationMinutes) * 60_000;
  const out: PlannedVisit[] = [];

  for (let week = 0; week < PLANNING_WEEKS; week++) {
    let inWeek = 0;
    for (let i = 0; i < 7; i++) {
      // Jour du calendrier local (et non + 24 h) : juste au changement d'heure.
      const { year, month, day } = addLocalDays(firstDay, week * 7 + i, tz);
      const dayStart = zonedToUtc(year, month, day, 0, 0, tz);
      const dow = localDayOfWeek(dayStart, tz);
      const daySlots = slots
        .filter((s) => s.dayOfWeek === dow)
        .sort((a, b) => SLOT_START_HOUR[a.slot] - SLOT_START_HOUR[b.slot]);
      for (const s of daySlots) {
        if (inWeek >= MAX_PER_WEEK[input.frequency]) break;
        if (input.frequency === "QUOTIDIENNE" && daySlots.indexOf(s) > 0) break; // une par jour
        const start = zonedToUtc(year, month, day, SLOT_START_HOUR[s.slot], 0, tz);
        if (start.getTime() < from.getTime()) continue;
        out.push({ scheduledStart: start, scheduledEnd: new Date(start.getTime() + duration) });
        inWeek++;
        if (input.frequency === "PONCTUELLE") return out;
      }
    }
  }
  return out;
}
