import { describe, expect, it } from "vitest";
import { mqDayOfWeek, mqMidnight, planVisits } from "./schedule";

// Lundi 5 octobre 2026, 10 h en Martinique = 14 h UTC.
const MONDAY_10H = new Date("2026-10-05T14:00:00Z");

const mq = (d: Date) => ({
  dow: mqDayOfWeek(d),
  hour: (d.getUTCHours() + 24 - 4) % 24,
});

describe("mqMidnight / mqDayOfWeek", () => {
  it("calcule minuit en Martinique (04:00 UTC)", () => {
    expect(mqMidnight(MONDAY_10H).toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });
  it("donne lundi = 0, même tard le soir (UTC du lendemain)", () => {
    expect(mqDayOfWeek(MONDAY_10H)).toBe(0);
    expect(mqDayOfWeek(new Date("2026-10-06T02:00:00Z"))).toBe(0); // lundi 22 h en Martinique
  });
});

describe("planVisits — visites des 4 prochaines semaines", () => {
  it("deux fois par semaine, mardi et jeudi après-midi → 8 visites à 14 h, durée respectée", () => {
    const visits = planVisits(
      {
        frequency: "DEUX_PAR_SEMAINE",
        durationMinutes: 90,
        startDate: null,
        slots: [
          { dayOfWeek: 1, slot: "APRES_MIDI" },
          { dayOfWeek: 3, slot: "APRES_MIDI" },
        ],
      },
      MONDAY_10H,
    );
    expect(visits).toHaveLength(8);
    for (const v of visits) {
      expect([1, 3]).toContain(mq(v.scheduledStart).dow);
      expect(mq(v.scheduledStart).hour).toBe(14);
      expect(v.scheduledEnd.getTime() - v.scheduledStart.getTime()).toBe(90 * 60_000);
    }
    const last = visits.at(-1)!.scheduledStart.getTime();
    expect(last - MONDAY_10H.getTime()).toBeLessThan(28 * 86_400_000);
  });

  it("hebdomadaire avec deux créneaux → une seule visite par semaine (4 au total)", () => {
    const visits = planVisits(
      {
        frequency: "HEBDOMADAIRE",
        durationMinutes: 120,
        startDate: null,
        slots: [
          { dayOfWeek: 2, slot: "MATIN" },
          { dayOfWeek: 4, slot: "MATIN" },
        ],
      },
      MONDAY_10H,
    );
    expect(visits).toHaveLength(4);
  });

  it("ne planifie jamais dans le passé (lundi matin déjà passé à 10 h)", () => {
    const visits = planVisits(
      { frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: null, slots: [{ dayOfWeek: 0, slot: "MATIN" }] },
      MONDAY_10H,
    );
    expect(visits[0]!.scheduledStart.getTime()).toBeGreaterThan(MONDAY_10H.getTime());
    expect(mq(visits[0]!.scheduledStart).dow).toBe(0);
    expect(visits).toHaveLength(3); // fenêtre de 28 jours : le 1er lundi est passé
  });

  it("commence à la date de début si elle est dans le futur", () => {
    const start = new Date("2026-10-19T13:00:00Z"); // lundi 19 octobre, 9 h Martinique
    const visits = planVisits(
      { frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: start, slots: [{ dayOfWeek: 0, slot: "MATIN" }] },
      MONDAY_10H,
    );
    expect(visits[0]!.scheduledStart.toISOString()).toBe(start.toISOString());
    expect(visits).toHaveLength(4);
  });

  it("ponctuelle → une seule visite", () => {
    const visits = planVisits(
      { frequency: "PONCTUELLE", durationMinutes: 60, startDate: null, slots: [{ dayOfWeek: 5, slot: "APRES_MIDI" }] },
      MONDAY_10H,
    );
    expect(visits).toHaveLength(1);
    expect(mq(visits[0]!.scheduledStart).dow).toBe(5);
  });

  it("quotidienne sans créneau → une visite par jour, le matin", () => {
    const visits = planVisits({ frequency: "QUOTIDIENNE", durationMinutes: 60, startDate: null, slots: [] }, MONDAY_10H);
    expect(visits.length).toBeGreaterThanOrEqual(27);
    expect(visits.length).toBeLessThanOrEqual(28);
    expect(visits.every((v) => mq(v.scheduledStart).hour === 9)).toBe(true);
  });

  it("sans créneau, hebdomadaire → le jour de début, le matin", () => {
    const visits = planVisits({ frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: null, slots: [] }, MONDAY_10H);
    expect(visits).toHaveLength(3); // le lundi 9 h de la 1re semaine est déjà passé
  });
});
