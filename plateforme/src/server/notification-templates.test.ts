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
  it("a un sujet et un corps pour chaque modèle", () => {
    for (const k of TEMPLATE_KEYS) {
      const r = renderTemplate(k, {});
      expect(r.subject.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
    }
  });
});
