import { describe, expect, it } from "vitest";
import { allowedLevelsFor, canStatusDoLevel, statusIsPaid } from "./status-levels";

describe("canStatusDoLevel", () => {
  it("interdit les niveaux 3 et 4 à un auto-entrepreneur", () => {
    expect(canStatusDoLevel("AUTO_ENTREPRENEUR_SAP", 3)).toBe(false);
    expect(canStatusDoLevel("AUTO_ENTREPRENEUR_SAP", 4)).toBe(false);
    expect(canStatusDoLevel("AUTO_ENTREPRENEUR_SAP", 4, { hasDiploma: true })).toBe(false);
  });

  it("autorise le niveau 2 (coups de main) à un auto-entrepreneur", () => {
    expect(canStatusDoLevel("AUTO_ENTREPRENEUR_SAP", 2)).toBe(true);
  });

  it("limite le bénévole au niveau 1 (lien)", () => {
    expect(allowedLevelsFor("BENEVOLE_ASSO")).toEqual([1]);
    expect(canStatusDoLevel("BENEVOLE_ASSO", 2)).toBe(false);
  });

  it("ouvre le niveau 4 au salarié de la famille seulement avec un diplôme", () => {
    expect(canStatusDoLevel("SALARIE_FAMILLE_CESU", 4)).toBe(false);
    expect(canStatusDoLevel("SALARIE_FAMILLE_CESU", 4, { hasDiploma: true })).toBe(true);
    expect(canStatusDoLevel("PROCHE_AIDANT_APA", 4, { hasDiploma: true })).toBe(true);
  });

  it("autorise tous les niveaux au SAAD", () => {
    expect(allowedLevelsFor("SAAD")).toEqual([1, 2, 3, 4]);
  });

  it("refuse un niveau hors de 1 à 4", () => {
    expect(canStatusDoLevel("SAAD", 0)).toBe(false);
    expect(canStatusDoLevel("SAAD", 5)).toBe(false);
    expect(canStatusDoLevel("SAAD", 2.5)).toBe(false);
  });

  it("ne demande pas de tarif au bénévole", () => {
    expect(statusIsPaid("BENEVOLE_ASSO")).toBe(false);
    expect(statusIsPaid("SALARIE_FAMILLE_CESU")).toBe(true);
  });
});
