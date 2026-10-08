import { describe, expect, it } from "vitest";
import { creneauLabel, creneauLabelOperateur, parisOffset } from "./rappel";
import { hourIn, readerPlace } from "@/components/ui/zoned-time";

describe("L1d (M4) : créneaux de rappel", () => {
  it("donne l'heure de Paris : +6 h en été, +5 h en hiver", () => {
    const ete = new Date("2026-07-01T12:00:00Z");
    const hiver = new Date("2026-12-01T12:00:00Z");
    expect(parisOffset(ete)).toBe(2);
    expect(parisOffset(hiver)).toBe(1);
    expect(creneauLabel("MATIN", ete)).toBe("8 h – 11 h en Martinique (14 h – 17 h à Paris)");
    expect(creneauLabel("APRES_MIDI", hiver)).toBe("14 h – 17 h en Martinique (19 h – 22 h à Paris)");
  });

  it("libellé opérateur, créneau inconnu compris", () => {
    expect(creneauLabelOperateur("MIDI")).toBe("11 h – 14 h (heure de Martinique)");
    expect(creneauLabelOperateur(null)).toBe("créneau non précisé");
  });
});

describe("L1d (M9, m7) : heures avec fuseau", () => {
  it("format unique « 9 h 30 », dans le fuseau demandé", () => {
    const d = new Date("2026-10-08T13:30:00Z");
    expect(hourIn(d, "America/Martinique")).toBe("9 h 30");
    expect(hourIn(d, "Europe/Paris")).toBe("15 h 30");
    expect(hourIn(new Date("2026-10-08T13:00:00Z"), "America/Martinique")).toBe("9 h");
  });

  it("nomme le lieu du lecteur", () => {
    expect(readerPlace("Europe/Paris")).toBe("à Paris");
    expect(readerPlace("America/Montreal")).toBe("chez vous");
  });
});
