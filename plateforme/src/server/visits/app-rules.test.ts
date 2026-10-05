import { describe, expect, it } from "vitest";
import { visiteSchema } from "@/contracts/v1/visits";
import { effectiveEventTime, isClockSkewed, motifFromServiceCode, toVisiteDto, type AppVisitRow } from "./app-rules";

const H = 3_600_000;
const now = new Date("2026-10-05T14:00:00Z");

function row(over: Partial<AppVisitRow> = {}): AppVisitRow {
  return {
    id: "cmvisite000000000000000001",
    scheduledStart: new Date(now.getTime() + H),
    scheduledEnd: new Date(now.getTime() + 3 * H),
    status: "PREVUE",
    proofScore: 0,
    checkInAt: null,
    checkOutAt: null,
    clockSkewAt: null,
    aine: { firstName: "Léonie", lastInitial: "R.", commune: "FORT_DE_FRANCE", addressHint: "Quartier Terres-Sainville (fictif)" },
    mission: { status: "ACTIVE", request: { level: 1, frequency: "HEBDOMADAIRE", durationMinutes: 120, notes: "Elle aime marcher." } },
    caregiver: { validation: "VALIDE" },
    proofs: [],
    journal: null,
    ...over,
  };
}

describe("horloge de l'appareil", () => {
  it("écart > 12 h dans les deux sens ; 12 h pile reste fiable", () => {
    expect(isClockSkewed(new Date(now.getTime() - 12 * H), now)).toBe(false);
    expect(isClockSkewed(new Date(now.getTime() - 12 * H - 1000), now)).toBe(true);
    expect(isClockSkewed(new Date(now.getTime() + 13 * H), now)).toBe(true);
    expect(isClockSkewed(new Date(now.getTime() - 3 * H), now)).toBe(false);
  });

  it("heure retenue : celle de l'appareil si fiable (jamais dans le futur), sinon celle du serveur", () => {
    const offline = new Date(now.getTime() - 3 * H);
    expect(effectiveEventTime(offline, now)).toEqual(offline);
    expect(effectiveEventTime(new Date(now.getTime() + 60_000), now)).toEqual(now);
    expect(effectiveEventTime(new Date(now.getTime() - 48 * H), now)).toEqual(now);
  });
});

describe("motif de refus", () => {
  it("convertit les codes du Lot B", () => {
    expect(motifFromServiceCode("INTROUVABLE")).toBe("INTROUVABLE");
    expect(motifFromServiceCode("TARIF")).toBe("INVALIDE");
    expect(motifFromServiceCode("CONFLIT")).toBe("CONFLIT");
  });
});

describe("toVisiteDto", () => {
  it("respecte le contrat (liste fermée de champs) et donne l'adresse approximative", () => {
    const dto = toVisiteDto(row(), now, false);
    expect(visiteSchema.safeParse(dto).success).toBe(true);
    expect(dto.aine).toMatchObject({ prenom: "Léonie", communeLibelle: "Fort-de-France", adresseApproximative: "Quartier Terres-Sainville (fictif)" });
    expect(dto.demande.consignes).toBe("Elle aime marcher.");
    expect(dto.actions).toEqual({ checkIn: true, checkOut: false, kaye: false });
  });

  it("après check-in : check-out et Kayé possibles ; Kayé publié : plus de Kayé", () => {
    const checked = row({ status: "EN_COURS", checkInAt: now, proofs: [{ factor: "CODE_DOMICILE", valid: true }] });
    expect(toVisiteDto(checked, now, false).actions).toEqual({ checkIn: false, checkOut: true, kaye: true });
    expect(toVisiteDto({ ...checked, journal: { id: "j" } }, now, false)).toMatchObject({ kayePublie: true, actions: { kaye: false } });
    expect(toVisiteDto(checked, now, false).preuve).toMatchObject({ score: 1, facteursValides: ["CODE_DOMICILE"], horlogeSuspecte: false });
  });

  it("profil suspendu ou mission suspendue : ni check-in ni Kayé", () => {
    expect(toVisiteDto(row({ caregiver: { validation: "SUSPENDU" } }), now, false).actions.checkIn).toBe(false);
    expect(toVisiteDto(row({ mission: { ...row().mission, status: "SUSPENDUE" } }), now, false).actions.checkIn).toBe(false);
  });

  it("check-in trop tôt hors mode test ; permis en mode test", () => {
    const later = row({ scheduledStart: new Date(now.getTime() + 5 * H), scheduledEnd: new Date(now.getTime() + 6 * H) });
    expect(toVisiteDto(later, now, false).actions.checkIn).toBe(false);
    expect(toVisiteDto(later, now, true).actions.checkIn).toBe(true);
  });

  it("horloge suspecte : signalée", () => {
    expect(toVisiteDto(row({ clockSkewAt: now, status: "A_VERIFIER" }), now, false).preuve.horlogeSuspecte).toBe(true);
  });
});
