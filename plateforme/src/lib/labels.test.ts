import { describe, expect, it } from "vitest";
import { MOOD_LABELS, MOOD_ORDER, PROOF_FACTOR_LABELS, proofCountLabel } from "./labels";
import { proofStateLabel } from "@/components/famille/proof-factors";

describe("vocabulaire unique (arbitrage V1 X4)", () => {
  it("3 preuves : Position à l'arrivée, Code du domicile, Confirmation de l'aîné", () => {
    expect(PROOF_FACTOR_LABELS).toEqual({
      GPS: "Position à l'arrivée",
      CODE_DOMICILE: "Code du domicile",
      CONFIRMATION_AINE: "Confirmation de l'aîné",
    });
  });

  it("compteur unique : « 1 preuve sur 3 », « 2 preuves sur 3 »", () => {
    expect(proofCountLabel(0)).toBe("0 preuve sur 3");
    expect(proofCountLabel(1)).toBe("1 preuve sur 3");
    expect(proofCountLabel(2)).toBe("2 preuves sur 3");
  });

  it("états : Obtenue / À faire (visite en cours) / Non obtenue (visite finie)", () => {
    expect(proofStateLabel("VALIDE", false)).toBe("Obtenue");
    expect(proofStateLabel("ABSENT", false)).toBe("À faire");
    expect(proofStateLabel("ABSENT", true)).toBe("Non obtenue");
    expect(proofStateLabel("NON_VALIDE", false)).toBe("Non obtenue");
  });

  it("humeur : du mieux au moins bien, de « Très bien » à « Pas bien »", () => {
    expect(MOOD_ORDER.map((m) => MOOD_LABELS[m])).toEqual(["Très bien", "Bien", "Correct", "Pas très bien", "Pas bien"]);
  });
});
