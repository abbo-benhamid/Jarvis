import { describe, expect, it } from "vitest";
import {
  computeVisitProof,
  deriveVisitStatus,
  evaluateGps,
  generateHomeCode,
  haversineMeters,
  HOME_CODE_ALPHABET,
  normalizeHomeCode,
  verifyHomeCode,
} from "./proof";

const FDF = { lat: 14.6161, lng: -61.0588 };

describe("computeVisitProof", () => {
  it("valide avec 2 facteurs sur 3", () => {
    const p = computeVisitProof([
      { factor: "GPS", valid: true },
      { factor: "CODE_DOMICILE", valid: true },
      { factor: "CONFIRMATION_AINE", valid: false },
    ]);
    expect(p.score).toBe(2);
    expect(p.isProven).toBe(true);
    expect(p.missingFactors).toEqual(["CONFIRMATION_AINE"]);
  });

  it("ne valide pas avec 1 seul facteur", () => {
    expect(computeVisitProof([{ factor: "GPS", valid: true }]).isProven).toBe(false);
  });

  it("compte un facteur une seule fois", () => {
    const p = computeVisitProof([
      { factor: "GPS", valid: true },
      { factor: "GPS", valid: true },
    ]);
    expect(p.score).toBe(1);
  });

  it("donne 0 sans facteur", () => {
    expect(computeVisitProof([]).score).toBe(0);
  });
});

describe("deriveVisitStatus", () => {
  const end = new Date("2026-10-04T12:00:00Z");
  const before = new Date("2026-10-04T11:00:00Z");
  const muchLater = new Date("2026-10-04T18:00:00Z");
  const none = computeVisitProof([]);
  const two = computeVisitProof([
    { factor: "GPS", valid: true },
    { factor: "CODE_DOMICILE", valid: true },
  ]);

  it("PREVUE sans check-in", () => {
    expect(deriveVisitStatus({ checkInAt: null, checkOutAt: null, scheduledEnd: end }, none, before)).toBe("PREVUE");
  });
  it("EN_COURS après check-in", () => {
    expect(deriveVisitStatus({ checkInAt: before, checkOutAt: null, scheduledEnd: end }, none, before)).toBe("EN_COURS");
  });
  it("VALIDEE dès 2 facteurs", () => {
    expect(deriveVisitStatus({ checkInAt: before, checkOutAt: null, scheduledEnd: end }, two, before)).toBe("VALIDEE");
  });
  it("A_VERIFIER après check-out sans preuve suffisante", () => {
    expect(deriveVisitStatus({ checkInAt: before, checkOutAt: end, scheduledEnd: end }, none, end)).toBe("A_VERIFIER");
  });
  it("A_VERIFIER si le délai est dépassé sans check-in", () => {
    expect(deriveVisitStatus({ checkInAt: null, checkOutAt: null, scheduledEnd: end }, none, muchLater)).toBe("A_VERIFIER");
  });
});

describe("GPS", () => {
  it("mesure ~3,4 km entre Fort-de-France et Schœlcher", () => {
    const d = haversineMeters(FDF, { lat: 14.6145, lng: -61.0905 });
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThan(4000);
  });
  it("valide une position à moins de 300 m", () => {
    expect(evaluateGps({ lat: 14.617, lng: -61.0588, accuracy: 20 }, FDF).valid).toBe(true);
  });
  it("refuse une position trop loin", () => {
    expect(evaluateGps({ lat: 14.63, lng: -61.0588 }, FDF)).toMatchObject({ valid: false, reason: "TROP_LOIN" });
  });
  it("refuse une position imprécise", () => {
    expect(evaluateGps({ ...FDF, accuracy: 2000 }, FDF)).toMatchObject({ valid: false, reason: "PRECISION_FAIBLE" });
  });
});

describe("code domicile", () => {
  it("génère 6 caractères de l'alphabet sans ambiguïté", () => {
    const code = generateHomeCode();
    expect(code).toHaveLength(6);
    for (const ch of code) expect(HOME_CODE_ALPHABET).toContain(ch);
  });
  it("accepte une saisie en minuscules avec espaces", () => {
    expect(normalizeHomeCode(" ab3 k-9z ")).toBe("AB3K9Z");
    expect(verifyHomeCode("ab3 k9z", "AB3K9Z")).toBe(true);
  });
  it("refuse un mauvais code", () => {
    expect(verifyHomeCode("AB3K9Y", "AB3K9Z")).toBe(false);
    expect(verifyHomeCode("AB3K9", "AB3K9Z")).toBe(false);
  });
});
