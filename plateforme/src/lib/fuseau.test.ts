import { describe, expect, it } from "vitest";
import { addLocalDays, hourIn, hoursBetween, localParts, offsetMinutes, zonedToUtc } from "./fuseau";

describe("fuseau (T4) : aucun décalage en dur", () => {
  const ete = new Date("2026-07-01T12:00:00Z");
  const hiver = new Date("2026-12-01T12:00:00Z");

  it("décalages : Guadeloupe et Martinique −4 h, Guyane −3 h, Paris +2 h l'été et +1 h l'hiver", () => {
    for (const d of [ete, hiver]) {
      expect(offsetMinutes(d, "America/Guadeloupe")).toBe(-240);
      expect(offsetMinutes(d, "America/Martinique")).toBe(-240);
      expect(offsetMinutes(d, "America/Cayenne")).toBe(-180);
    }
    expect(offsetMinutes(ete, "Europe/Paris")).toBe(120);
    expect(offsetMinutes(hiver, "Europe/Paris")).toBe(60);
  });

  it("heure locale → UTC, y compris au changement d'heure de Paris", () => {
    expect(zonedToUtc(2026, 10, 5, 9, 0, "America/Guadeloupe").toISOString()).toBe("2026-10-05T13:00:00.000Z");
    expect(zonedToUtc(2026, 10, 5, 9, 0, "America/Cayenne").toISOString()).toBe("2026-10-05T12:00:00.000Z");
    expect(zonedToUtc(2026, 10, 24, 9, 0, "Europe/Paris").toISOString()).toBe("2026-10-24T07:00:00.000Z");
    expect(zonedToUtc(2026, 10, 25, 9, 0, "Europe/Paris").toISOString()).toBe("2026-10-25T08:00:00.000Z");
    // 2 h 30 n'existe pas le 29 mars 2026 à Paris : décalé vers l'avant (3 h 30 heure d'été).
    expect(localParts(zonedToUtc(2026, 3, 29, 2, 30, "Europe/Paris"), "Europe/Paris").hour).toBe(3);
    // 2 h 30 existe deux fois le 25 octobre 2026 : la première (heure d'été).
    expect(zonedToUtc(2026, 10, 25, 2, 30, "Europe/Paris").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("jours du calendrier local et libellés", () => {
    expect(addLocalDays(new Date("2026-10-06T02:00:00Z"), 1, "America/Guadeloupe")).toEqual({ year: 2026, month: 10, day: 6 });
    expect(addLocalDays(new Date("2026-12-31T12:00:00Z"), 1, "Europe/Paris")).toEqual({ year: 2027, month: 1, day: 1 });
    expect(hourIn(new Date("2026-10-08T13:30:00Z"), "America/Guadeloupe")).toBe("9 h 30");
    expect(hourIn(new Date("2026-10-08T13:00:00Z"), "America/Cayenne")).toBe("10 h");
    expect(hoursBetween("America/Guadeloupe", "Europe/Paris", ete)).toBe(6);
    expect(hoursBetween("America/Guadeloupe", "Europe/Paris", hiver)).toBe(5);
  });
});
