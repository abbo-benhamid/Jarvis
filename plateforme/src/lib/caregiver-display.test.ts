import { describe, expect, it } from "vitest";
import { caregiverDisplayName } from "./caregiver-display";

describe("caregiverDisplayName (D8)", () => {
  it("affiche un SAAD comme une structure partenaire", () => {
    expect(caregiverDisplayName({ status: "SAAD", saadName: "Aide Plus", user: { firstName: "Mylène", lastName: "Bérard" } })).toBe(
      "Structure partenaire : Aide Plus",
    );
  });
  it("affiche une personne avec son prénom et l'initiale du nom", () => {
    expect(caregiverDisplayName({ status: "SALARIE_FAMILLE_CESU", user: { firstName: "Josiane", lastName: "Labeau" } })).toBe("Josiane L.");
  });
});
