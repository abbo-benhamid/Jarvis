import { describe, expect, it } from "vitest";
import { checkCompatibility, type CaregiverForMatching } from "./matching";

const josiane: CaregiverForMatching = {
  status: "SALARIE_FAMILLE_CESU",
  validation: "VALIDE",
  hasDiploma: false,
  territoire: "GUADELOUPE",
  communes: ["POINTE_A_PITRE", "ABYMES"],
  availabilities: [
    { dayOfWeek: 0, slot: "MATIN" },
    { dayOfWeek: 2, slot: "APRES_MIDI" },
  ],
};

describe("checkCompatibility", () => {
  it("accepte un profil compatible", () => {
    const r = checkCompatibility(josiane, { territoire: "GUADELOUPE", level: 3, commune: "ABYMES", slots: [{ dayOfWeek: 2, slot: "APRES_MIDI" }] });
    expect(r.compatible).toBe(true);
    expect(r.commonSlots).toHaveLength(1);
  });

  it("refuse un auto-entrepreneur pour un niveau 3", () => {
    const r = checkCompatibility(
      { ...josiane, status: "AUTO_ENTREPRENEUR_SAP" },
      { territoire: "GUADELOUPE", level: 3, commune: "POINTE_A_PITRE", slots: [] },
    );
    expect(r.compatible).toBe(false);
    expect(r.reasons).toContain("NIVEAU_NON_AUTORISE");
  });

  it("T1 (T3) : jamais un profil d'un autre territoire ; jamais dans un territoire pas encore ouvert", () => {
    const autre = checkCompatibility(josiane, { territoire: "MARTINIQUE", level: 1, commune: "FORT_DE_FRANCE", slots: [] });
    expect(autre.compatible).toBe(false);
    expect(autre.reasons).toEqual(["TERRITOIRE"]);
    const mq: CaregiverForMatching = { ...josiane, territoire: "MARTINIQUE", communes: ["FORT_DE_FRANCE"] };
    const ferme = checkCompatibility(mq, { territoire: "MARTINIQUE", level: 1, commune: "FORT_DE_FRANCE", slots: [] });
    expect(ferme.reasons).toEqual(["TERRITOIRE_FERME"]);
  });

  it("refuse une commune non desservie", () => {
    const r = checkCompatibility(josiane, { territoire: "GUADELOUPE", level: 1, commune: "LAMENTIN_GP", slots: [] });
    expect(r.reasons).toEqual(["COMMUNE"]);
  });

  it("refuse sans créneau commun", () => {
    const r = checkCompatibility(josiane, { territoire: "GUADELOUPE", level: 1, commune: "POINTE_A_PITRE", slots: [{ dayOfWeek: 6, slot: "SOIR" }] });
    expect(r.reasons).toEqual(["DISPONIBILITE"]);
  });

  it("refuse un profil non vérifié ou sans statut", () => {
    const r = checkCompatibility({ ...josiane, validation: "EN_ATTENTE", status: null }, { territoire: "GUADELOUPE", level: 1, commune: "POINTE_A_PITRE", slots: [] });
    expect(r.reasons).toEqual(expect.arrayContaining(["NON_VALIDE", "SANS_STATUT"]));
  });

  it("D7 : propose un proche aidant seulement pour l'aîné de sa famille", () => {
    const nadege: CaregiverForMatching = { ...josiane, status: "PROCHE_AIDANT_APA", linkedAineId: "aine-yvette" };
    const sienne = checkCompatibility(nadege, { territoire: "GUADELOUPE", level: 1, commune: "ABYMES", slots: [], aineId: "aine-yvette" });
    expect(sienne.compatible).toBe(true);
    const autre = checkCompatibility(nadege, { territoire: "GUADELOUPE", level: 1, commune: "ABYMES", slots: [], aineId: "aine-leonie" });
    expect(autre.reasons).toEqual(["LIEN_FAMILIAL"]);
    const sansLien = checkCompatibility({ ...nadege, linkedAineId: null }, { territoire: "GUADELOUPE", level: 1, commune: "ABYMES", slots: [], aineId: "aine-yvette" });
    expect(sansLien.reasons).toEqual(["LIEN_FAMILIAL"]);
  });
});
