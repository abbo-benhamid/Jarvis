import { describe, expect, it } from "vitest";
import { renderTemplate, TEMPLATE_KEYS } from "./notification-templates";

describe("renderTemplate", () => {
  it("remplace les variables", () => {
    const r = renderTemplate("VISITE_VALIDEE", { aine: "Léonie", date: "4 octobre 2026", score: 2 });
    expect(r.body).toBe("La visite chez Léonie du 4 octobre 2026 est validée (2 preuves sur 3).");
  });
  it("laisse visible une variable manquante", () => {
    expect(renderTemplate("KAYE_PUBLIE", { aine: "Léonie" }).body).toContain("{accompagnant}");
  });
  it("marque les messages simulés", () => {
    expect(renderTemplate("APPEL_CONFIRMATION_AINE", {}).body).toMatch(/^\[SIMULATION\]/);
    expect(renderTemplate("PAIEMENT_SIMULE", {}).body).toMatch(/Aucun paiement réel/);
  });
  it("n'expose pas l'accompagnant qui refuse une proposition", () => {
    const r = renderTemplate("PROPOSITION_REFUSEE", { aine: "Léonie", accompagnant: "Josiane" });
    expect(r.body).not.toContain("Josiane");
    expect(r.subject).not.toContain("Josiane");
  });
  it("donne le motif et le recours dans le message de suspension", () => {
    const r = renderTemplate("ACCOMPAGNANT_SUSPENDU", { prenom: "Line", motif: "Absence non prévenue" });
    expect(r.body).toContain("Absence non prévenue");
    expect(r.body).toContain("réexamen");
  });
  it("a un sujet et un corps pour chaque modèle", () => {
    for (const k of TEMPLATE_KEYS) {
      const r = renderTemplate(k, {});
      expect(r.subject.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
    }
  });
});
