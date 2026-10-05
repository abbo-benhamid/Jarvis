import { describe, expect, it } from "vitest";
import { employerSentence, requestAuthorText } from "./request-texts";

const aine = { firstName: "Léonie" };

describe("page Demandes (UX V1 M9)", () => {
  it("« Demande de X » expliqué : la mienne, un proche du cercle, un personnage du test", () => {
    const r = { createdById: "u-fred", createdBy: { firstName: "Frédéric" }, aine };
    expect(requestAuthorText({ ...r, createdById: "u-nadia" }, { id: "u-nadia", sandboxId: null })).toBe("Votre demande");
    expect(requestAuthorText(r, { id: "u-nadia", sandboxId: null })).toBe("Demande faite par Frédéric, un proche du cercle de Léonie");
    expect(requestAuthorText(r, { id: "u-nadia", sandboxId: "sb1" })).toBe("Demande faite par Frédéric (un proche, personnage du test)");
  });

  it("employeur : une seule phrase cohérente avec la ligne « Employeur »", () => {
    expect(employerSentence({ employerType: "AINE", employerName: "Léonie J.", aine })).toBe("Léonie est l'employeur. Vous choisissez avec Léonie.");
    expect(employerSentence({ employerType: "REPRESENTANT", employerName: "Nadia J.", aine })).toBe(
      "Nadia J., représentant de Léonie, est l'employeur et choisit la personne.",
    );
    expect(employerSentence({ employerType: "REPRESENTANT", employerName: null, aine })).toContain("Le représentant de Léonie");
    // Jamais « Vous êtes l'employeur » quand l'aîné est l'employeur.
    expect(employerSentence({ employerType: "AINE", employerName: null, aine })).not.toContain("Vous êtes l'employeur");
  });
});
