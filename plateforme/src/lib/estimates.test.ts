import { describe, expect, it } from "vitest";
import { monthlyCostExample, netHourlyCents, netIncomeEstimate } from "./estimates";

describe("coût mensuel d'exemple (A3)", () => {
  it("ajoute les heures à l'abonnement et applique le crédit d'impôt aux heures seulement", () => {
    const ex = monthlyCostExample(14900, 4, 2, 2000);
    expect(ex.hours).toBe(8);
    expect(ex.hoursCostCents).toBe(16000);
    expect(ex.taxCreditCents).toBe(8000);
    expect(ex.totalCents).toBe(14900 + 8000);
  });
  it("formule gratuite sans visite : 0 €", () => {
    expect(monthlyCostExample(0, 0).totalCents).toBe(0);
  });
});

describe("revenu net estimé (A4)", () => {
  it("salarié : environ 78 % du brut", () => {
    expect(netHourlyCents("SALARIE_FAMILLE_CESU", 1400)).toBe(1092);
  });
  it("bénévole et SAAD : pas d'estimation", () => {
    expect(netHourlyCents("BENEVOLE_ASSO", 1400)).toBeNull();
    expect(netHourlyCents("SAAD", 1400)).toBeNull();
    expect(netHourlyCents("SALARIE_FAMILLE_CESU", null)).toBeNull();
  });
  it("calcule par visite et par mois", () => {
    const e = netIncomeEstimate("AUTO_ENTREPRENEUR_SAP", 2000, 120, 4);
    expect(e).toEqual({ hourlyCents: 1576, perVisitCents: 3152, perMonthCents: 12608, visitsPerMonth: 4 });
  });
});
