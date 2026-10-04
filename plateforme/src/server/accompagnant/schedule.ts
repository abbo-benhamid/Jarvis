/**
 * Planification des visites d'une mission (Lot B). Fonctions PURES.
 * Règle : à l'acceptation, Koudmen crée les visites des 4 prochaines semaines.
 * Fuseau : Martinique = UTC−4, sans heure d'été.
 */
import type { Frequency, TimeSlot } from "@prisma/client";

export const PLANNING_WEEKS = 4;
const DAY_MS = 86_400_000;
const MQ_OFFSET_HOURS = 4; // heure locale = UTC − 4 h

/** Heure de début (heure de Martinique) de chaque créneau. */
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
};

export type PlannedVisit = { scheduledStart: Date; scheduledEnd: Date };

/** Minuit (heure de Martinique) du jour qui contient `d`, exprimé en UTC. */
export function mqMidnight(d: Date): Date {
  const local = new Date(d.getTime() - MQ_OFFSET_HOURS * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), MQ_OFFSET_HOURS));
}

/** Jour de la semaine en Martinique : 0 = lundi … 6 = dimanche. */
export function mqDayOfWeek(d: Date): number {
  const local = new Date(d.getTime() - MQ_OFFSET_HOURS * 3_600_000);
  return (local.getUTCDay() + 6) % 7;
}

function slotsOrDefault(input: PlanInput, firstDay: Date): { dayOfWeek: number; slot: TimeSlot }[] {
  if (input.slots.length > 0) return input.slots;
  const d0 = mqDayOfWeek(firstDay);
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
 * - Fenêtre : du plus tard entre `now` et la date de début, sur 28 jours.
 * - Une visite par créneau demandé, dans la limite de la fréquence (par bloc de 7 jours).
 * - Ponctuelle : une seule visite.
 * - Aucune visite dans le passé.
 */
export function planVisits(input: PlanInput, now: Date = new Date()): PlannedVisit[] {
  const from = input.startDate && input.startDate.getTime() > now.getTime() ? input.startDate : now;
  const firstDay = mqMidnight(from);
  const slots = slotsOrDefault(input, firstDay);
  const duration = Math.max(15, input.durationMinutes) * 60_000;
  const out: PlannedVisit[] = [];

  for (let week = 0; week < PLANNING_WEEKS; week++) {
    let inWeek = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(firstDay.getTime() + (week * 7 + i) * DAY_MS);
      const dow = mqDayOfWeek(day);
      const daySlots = slots
        .filter((s) => s.dayOfWeek === dow)
        .sort((a, b) => SLOT_START_HOUR[a.slot] - SLOT_START_HOUR[b.slot]);
      for (const s of daySlots) {
        if (inWeek >= MAX_PER_WEEK[input.frequency]) break;
        if (input.frequency === "QUOTIDIENNE" && daySlots.indexOf(s) > 0) break; // une par jour
        const start = new Date(day.getTime() + SLOT_START_HOUR[s.slot] * 3_600_000);
        if (start.getTime() < from.getTime()) continue;
        out.push({ scheduledStart: start, scheduledEnd: new Date(start.getTime() + duration) });
        inWeek++;
        if (input.frequency === "PONCTUELLE") return out;
      }
    }
  }
  return out;
}
