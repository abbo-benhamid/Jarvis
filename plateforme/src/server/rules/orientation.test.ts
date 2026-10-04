import { describe, expect, it } from "vitest";
import { orientCaregiver, type OrientationAnswers } from "./orientation";

const base: OrientationAnswers = {
  activity: "PRESENCE",
  paid: true,
  existingStatus: "AUCUN",
  situations: [],
  familyLink: "AUCUN",
};

describe("orientCaregiver (5 questions)", () => {
  it("recommande salarié de la famille par défaut", () => {
    const r = orientCaregiver(base);
    expect(r.outcome).toBe("RECOMMANDE");
    expect(r.status).toBe("SALARIE_FAMILLE_CESU");
    expect(r.allowedLevels).toEqual([1, 2, 3]);
    expect(r.requiredVerifications).toContain("PSC1");
  });

  it("oriente un bénévole de lien vers l'association", () => {
    const r = orientCaregiver({ ...base, activity: "LIEN", paid: false });
    expect(r.status).toBe("BENEVOLE_ASSO");
    expect(r.allowedLevels).toEqual([1]);
    expect(r.requiredVerifications).not.toContain("REFERENCES");
  });

  it("refuse une aide régulière non payée", () => {
    const r = orientCaregiver({ ...base, paid: false });
    expect(r.outcome).toBe("REFUSE");
    expect(r.status).toBeNull();
  });

  it("garde l'auto-entrepreneur pour les coups de main", () => {
    const r = orientCaregiver({ ...base, activity: "COUPS_DE_MAIN", existingStatus: "AUTO_ENTREPRENEUR_SAP" });
    expect(r.status).toBe("AUTO_ENTREPRENEUR_SAP");
    expect(r.allowedLevels).toEqual([2]);
    expect(r.requiredVerifications).toContain("STATUT_PRO");
  });

  it("bascule un auto-entrepreneur en salarié pour la présence", () => {
    const r = orientCaregiver({ ...base, existingStatus: "AUTO_ENTREPRENEUR_SAP" });
    expect(r.status).toBe("SALARIE_FAMILLE_CESU");
    expect(r.warnings.join(" ")).toMatch(/auto-entrepreneur/);
  });

  it("met en liste d'attente un agent public", () => {
    const r = orientCaregiver({ ...base, situations: ["AGENT_PUBLIC"] });
    expect(r.outcome).toBe("LISTE_ATTENTE");
  });

  it("affiche la règle de cumul pour un demandeur d'emploi", () => {
    const r = orientCaregiver({ ...base, situations: ["DEMANDEUR_EMPLOI"] });
    expect(r.outcome).toBe("RECOMMANDE");
    expect(r.warnings.some((w) => w.includes("France Travail"))).toBe(true);
  });

  it("propose le statut proche aidant à un enfant de l'aîné", () => {
    const r = orientCaregiver({ ...base, familyLink: "ENFANT_OU_PARENT" });
    expect(r.status).toBe("PROCHE_AIDANT_APA");
  });

  it("oriente un conjoint vers PCH / AJPA", () => {
    const r = orientCaregiver({ ...base, familyLink: "CONJOINT" });
    expect(r.outcome).toBe("ORIENTATION_EXTERNE");
    expect(r.status).toBeNull();
  });

  it("route un salarié de SAAD vers le statut SAAD", () => {
    const r = orientCaregiver({ ...base, activity: "AIDE_RENFORCEE", existingStatus: "SALARIE_SAAD" });
    expect(r.status).toBe("SAAD");
    expect(r.allowedLevels).toContain(4);
    expect(r.requiredVerifications).not.toContain("DIPLOME");
  });

  it("exige un diplôme pour l'aide renforcée hors SAAD", () => {
    const r = orientCaregiver({ ...base, activity: "AIDE_RENFORCEE" });
    expect(r.status).toBe("SALARIE_FAMILLE_CESU");
    expect(r.allowedLevels).not.toContain(4);
    expect(r.requiredVerifications).toContain("DIPLOME");
  });
});
