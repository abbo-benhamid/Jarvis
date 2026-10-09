import { describe, expect, it } from "vitest";
import { creneauLabel, creneauLabelOperateur, parisOffset } from "./rappel";
import { hourIn, readerPlace } from "@/components/ui/zoned-time";

describe("L1d (M4) et T1 (T4) : créneaux de rappel", () => {
  const ete = new Date("2026-07-01T12:00:00Z");
  const hiver = new Date("2026-12-01T12:00:00Z");

  it("donne l'heure de Paris : +6 h en été, +5 h en hiver (équipe en Guadeloupe)", () => {
    expect(parisOffset(ete)).toBe(2);
    expect(parisOffset(hiver)).toBe(1);
    expect(creneauLabel("MATIN", ete)).toBe("8 h – 11 h en Guadeloupe (14 h – 17 h à Paris)");
    expect(creneauLabel("APRES_MIDI", hiver)).toBe("14 h – 17 h en Guadeloupe (19 h – 22 h à Paris)");
  });

  it("autres territoires d'équipe : Guyane (+5 h / +4 h), Hexagone (pas de double heure)", () => {
    expect(creneauLabel("MATIN", ete, "GUYANE")).toBe("8 h – 11 h en Guyane (13 h – 16 h à Paris)");
    expect(creneauLabel("MATIN", hiver, "GUYANE")).toBe("8 h – 11 h en Guyane (12 h – 15 h à Paris)");
    expect(creneauLabel("MIDI", ete, "HEXAGONE")).toBe("11 h – 14 h dans l'Hexagone");
  });

  it("libellé opérateur, créneau inconnu compris", () => {
    expect(creneauLabelOperateur("MIDI")).toBe("11 h – 14 h (heure de Guadeloupe)");
    expect(creneauLabelOperateur(null)).toBe("créneau non précisé");
  });
});

describe("L1d (M9, m7) : heures avec fuseau", () => {
  it("format unique « 9 h 30 », dans le fuseau demandé", () => {
    const d = new Date("2026-10-08T13:30:00Z");
    expect(hourIn(d, "America/Guadeloupe")).toBe("9 h 30");
    expect(hourIn(d, "America/Cayenne")).toBe("10 h 30");
    expect(hourIn(d, "Europe/Paris")).toBe("15 h 30");
    expect(hourIn(new Date("2026-10-08T13:00:00Z"), "America/Guadeloupe")).toBe("9 h");
  });

  it("nomme le lieu du lecteur", () => {
    expect(readerPlace("Europe/Paris")).toBe("à Paris");
    expect(readerPlace("America/Martinique")).toBe("en Martinique");
    expect(readerPlace("America/Montreal")).toBe("chez vous");
  });
});
