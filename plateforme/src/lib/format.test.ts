import { describe, expect, it } from "vitest";
import { deName, formatDate, initialWithDot } from "./format";
import { errorText } from "@/components/ui/form-message";

describe("finitions de langue (S1b-ux m7, m11)", () => {
  it("élide « de » devant une voyelle", () => {
    expect(deName("Ernest")).toBe("d'Ernest");
    expect(deName("Léonie")).toBe("de Léonie");
    expect(deName("Hélène")).toBe("d'Hélène");
  });
  it("met un seul point après l'initiale", () => {
    expect(initialWithDot("B.")).toBe("B.");
    expect(initialWithDot("B")).toBe("B.");
    expect(initialWithDot(null)).toBe("");
  });
  it("écrit « 1er » pour le premier jour du mois", () => {
    expect(formatDate(new Date("2026-10-01T16:00:00Z"))).toBe("1er octobre 2026");
    expect(formatDate(new Date("2026-10-11T16:00:00Z"))).toBe("11 octobre 2026");
  });
  it("ne parle plus de couleur dans le message d'erreur global", () => {
    expect(errorText({ error: "Vérifiez les champs en rouge.", fieldErrors: { a: ["x"], b: ["y"] } })).toBe(
      "Corrigez les 2 champs signalés ci-dessous.",
    );
    expect(errorText({ error: "Autre erreur." })).toBe("Autre erreur.");
  });
});
