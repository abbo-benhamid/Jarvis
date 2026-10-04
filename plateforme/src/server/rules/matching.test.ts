import { describe, expect, it } from "vitest";
import { checkCompatibility, type CaregiverForMatching } from "./matching";

const josiane: CaregiverForMatching = {
  status: "SALARIE_FAMILLE_CESU",
  validation: "VALIDE",
  hasDiploma: false,
  communes: ["FORT_DE_FRANCE", "SCHOELCHER"],
  availabilities: [
    { dayOfWeek: 0, slot: "MATIN" },
    { dayOfWeek: 2, slot: "APRES_MIDI" },
  ],
};

describe("checkCompatibility", () => {
  it("accepte un profil compatible", () => {
    const r = checkCompatibility(josiane, { level: 3, commune: "SCHOELCHER", slots: [{ dayOfWeek: 2, slot: "APRES_MIDI" }] });
    expect(r.compatible).toBe(true);
    expect(r.commonSlots).toHaveLength(1);
  });

  it("refuse un auto-entrepreneur pour un niveau 3", () => {
    const r = checkCompatibility(
      { ...josiane, status: "AUTO_ENTREPRENEUR_SAP" },
      { level: 3, commune: "FORT_DE_FRANCE", slots: [] },
    );
    expect(r.compatible).toBe(false);
    expect(r.reasons).toContain("NIVEAU_NON_AUTORISE");
  });

  it("refuse une commune non desservie", () => {
    const r = checkCompatibility(josiane, { level: 1, commune: "LAMENTIN", slots: [] });
    expect(r.reasons).toEqual(["COMMUNE"]);
  });

  it("refuse sans créneau commun", () => {
    const r = checkCompatibility(josiane, { level: 1, commune: "FORT_DE_FRANCE", slots: [{ dayOfWeek: 6, slot: "SOIR" }] });
    expect(r.reasons).toEqual(["DISPONIBILITE"]);
  });

  it("refuse un profil non vérifié ou sans statut", () => {
    const r = checkCompatibility({ ...josiane, validation: "EN_ATTENTE", status: null }, { level: 1, commune: "FORT_DE_FRANCE", slots: [] });
    expect(r.reasons).toEqual(expect.arrayContaining(["NON_VALIDE", "SANS_STATUT"]));
  });
});
