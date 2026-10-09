import { describe, expect, it } from "vitest";
import { localDayOfWeek, localMidnight, planVisits, type PlanInput } from "./schedule";
import { localParts } from "@/lib/fuseau";

const GP = "America/Guadeloupe";
const GY = "America/Cayenne";
const PARIS = "Europe/Paris";

// Lundi 5 octobre 2026, 10 h en Guadeloupe = 14 h UTC.
const MONDAY_10H = new Date("2026-10-05T14:00:00Z");

const loc = (d: Date, tz = GP) => ({ dow: localDayOfWeek(d, tz), hour: localParts(d, tz).hour });
const plan = (p: Omit<PlanInput, "timeZone"> & { timeZone?: string }, now = MONDAY_10H) => planVisits({ timeZone: GP, ...p }, now);

describe("localMidnight / localDayOfWeek (fuseau du territoire)", () => {
  it("minuit en Guadeloupe = 04:00 UTC ; en Guyane = 03:00 UTC", () => {
    expect(localMidnight(MONDAY_10H, GP).toISOString()).toBe("2026-10-05T04:00:00.000Z");
    expect(localMidnight(MONDAY_10H, GY).toISOString()).toBe("2026-10-05T03:00:00.000Z");
  });
  it("Hexagone : minuit = 22:00 UTC la veille en été, 23:00 UTC en hiver", () => {
    expect(localMidnight(new Date("2026-07-15T10:00:00Z"), PARIS).toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(localMidnight(new Date("2026-12-15T10:00:00Z"), PARIS).toISOString()).toBe("2026-12-14T23:00:00.000Z");
  });
  it("donne lundi = 0, même tard le soir (UTC du lendemain)", () => {
    expect(localDayOfWeek(MONDAY_10H, GP)).toBe(0);
    expect(localDayOfWeek(new Date("2026-10-06T02:00:00Z"), GP)).toBe(0); // lundi 22 h en Guadeloupe
    expect(localDayOfWeek(new Date("2026-10-06T02:00:00Z"), GY)).toBe(0); // lundi 23 h en Guyane
    expect(localDayOfWeek(new Date("2026-10-06T02:00:00Z"), PARIS)).toBe(1); // mardi 4 h à Paris
  });
});

describe("planVisits — visites des 4 prochaines semaines", () => {
  it("deux fois par semaine, mardi et jeudi après-midi → 8 visites à 14 h, durée respectée", () => {
    const visits = plan({
      frequency: "DEUX_PAR_SEMAINE",
      durationMinutes: 90,
      startDate: null,
      slots: [
        { dayOfWeek: 1, slot: "APRES_MIDI" },
        { dayOfWeek: 3, slot: "APRES_MIDI" },
      ],
    });
    expect(visits).toHaveLength(8);
    for (const v of visits) {
      expect([1, 3]).toContain(loc(v.scheduledStart).dow);
      expect(loc(v.scheduledStart).hour).toBe(14);
      expect(v.scheduledEnd.getTime() - v.scheduledStart.getTime()).toBe(90 * 60_000);
    }
    expect(visits[0]!.scheduledStart.toISOString()).toBe("2026-10-06T18:00:00.000Z");
    const last = visits.at(-1)!.scheduledStart.getTime();
    expect(last - MONDAY_10H.getTime()).toBeLessThan(28 * 86_400_000);
  });

  it("Guyane (UTC − 3) : 14 h locale = 17 h UTC", () => {
    const visits = plan({ timeZone: GY, frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: null, slots: [{ dayOfWeek: 1, slot: "APRES_MIDI" }] });
    expect(visits[0]!.scheduledStart.toISOString()).toBe("2026-10-06T17:00:00.000Z");
    expect(visits.every((v) => loc(v.scheduledStart, GY).hour === 14)).toBe(true);
  });

  it("Hexagone : 9 h locale avant et après le passage à l'heure d'hiver (25 octobre 2026)", () => {
    const now = new Date("2026-10-19T12:00:00Z"); // lundi 19 octobre, 14 h à Paris
    const visits = plan({ timeZone: PARIS, frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: null, slots: [{ dayOfWeek: 2, slot: "MATIN" }] }, now);
    expect(visits.map((v) => v.scheduledStart.toISOString())).toEqual([
      "2026-10-21T07:00:00.000Z", // été : UTC + 2
      "2026-10-28T08:00:00.000Z", // hiver : UTC + 1
      "2026-11-04T08:00:00.000Z",
      "2026-11-11T08:00:00.000Z",
    ]);
    expect(visits.every((v) => loc(v.scheduledStart, PARIS).hour === 9 && loc(v.scheduledStart, PARIS).dow === 2)).toBe(true);
  });

  it("Hexagone : quotidienne pendant le changement d'heure → une visite par jour, toujours à 9 h", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const visits = plan({ timeZone: PARIS, frequency: "QUOTIDIENNE", durationMinutes: 60, startDate: null, slots: [] }, now);
    expect(visits.every((v) => loc(v.scheduledStart, PARIS).hour === 9)).toBe(true);
    const days = visits.map((v) => localParts(v.scheduledStart, PARIS).day);
    expect(new Set(days.map((d, i) => `${i}-${d}`)).size).toBe(days.length);
    expect(visits.length).toBeGreaterThanOrEqual(27);
  });

  it("hebdomadaire avec deux créneaux → une seule visite par semaine (4 au total)", () => {
    const visits = plan({
      frequency: "HEBDOMADAIRE",
      durationMinutes: 120,
      startDate: null,
      slots: [
        { dayOfWeek: 2, slot: "MATIN" },
        { dayOfWeek: 4, slot: "MATIN" },
      ],
    });
    expect(visits).toHaveLength(4);
  });

  it("ne planifie jamais dans le passé (lundi matin déjà passé à 10 h)", () => {
    const visits = plan({ frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: null, slots: [{ dayOfWeek: 0, slot: "MATIN" }] });
    expect(visits[0]!.scheduledStart.getTime()).toBeGreaterThan(MONDAY_10H.getTime());
    expect(loc(visits[0]!.scheduledStart).dow).toBe(0);
    expect(visits).toHaveLength(3); // fenêtre de 28 jours : le 1er lundi est passé
  });

  it("commence à la date de début si elle est dans le futur", () => {
    const start = new Date("2026-10-19T13:00:00Z"); // lundi 19 octobre, 9 h en Guadeloupe
    const visits = plan({ frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: start, slots: [{ dayOfWeek: 0, slot: "MATIN" }] });
    expect(visits[0]!.scheduledStart.toISOString()).toBe(start.toISOString());
    expect(visits).toHaveLength(4);
  });

  it("ponctuelle → une seule visite", () => {
    const visits = plan({ frequency: "PONCTUELLE", durationMinutes: 60, startDate: null, slots: [{ dayOfWeek: 5, slot: "APRES_MIDI" }] });
    expect(visits).toHaveLength(1);
    expect(loc(visits[0]!.scheduledStart).dow).toBe(5);
  });

  it("quotidienne sans créneau → une visite par jour, le matin", () => {
    const visits = plan({ frequency: "QUOTIDIENNE", durationMinutes: 60, startDate: null, slots: [] });
    expect(visits.length).toBeGreaterThanOrEqual(27);
    expect(visits.length).toBeLessThanOrEqual(28);
    expect(visits.every((v) => loc(v.scheduledStart).hour === 9)).toBe(true);
  });

  it("sans créneau, hebdomadaire → le jour de début, le matin", () => {
    const visits = plan({ frequency: "HEBDOMADAIRE", durationMinutes: 60, startDate: null, slots: [] });
    expect(visits).toHaveLength(3); // le lundi 9 h de la 1re semaine est déjà passé
  });
});
