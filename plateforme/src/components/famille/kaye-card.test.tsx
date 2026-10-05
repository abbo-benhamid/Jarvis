// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KayeCard, type KayeEntry } from "./kaye-card";

const base: KayeEntry = {
  id: "k1",
  mood: 4,
  activities: ["Discussion", "Promenade"],
  appetite: "BON",
  note: "Nous avons marché jusqu'à la Savane.",
  alertFlag: false,
  alertNote: null,
  createdAt: new Date("2026-09-06T15:15:00Z"),
  aine: { id: "a1", firstName: "Léonie" },
  author: { firstName: "Josiane" },
  visit: { scheduledStart: new Date("2026-09-06T13:00:00Z") },
};

describe("KayeCard", () => {
  it("affiche l'humeur en texte, la note, les activités et l'appétit", () => {
    render(<KayeCard entry={base} />);
    expect(screen.getByRole("heading", { name: "Léonie allait bien." })).toBeInTheDocument();
    expect(screen.getByText("Humeur : Bien (4 sur 5)")).toBeInTheDocument();
    expect(screen.getByText(/marché jusqu'à la Savane/)).toBeInTheDocument();
    expect(screen.getByText("Promenade")).toBeInTheDocument();
    expect(screen.getByText("Bon")).toBeInTheDocument();
    expect(screen.queryByText("À surveiller")).not.toBeInTheDocument();
  });

  it("montre le reçu de visite (preuve) en tête du Kayé", () => {
    render(
      <KayeCard
        entry={{
          ...base,
          visit: {
            ...base.visit,
            status: "VALIDEE",
            checkInAt: new Date("2026-09-06T18:02:00Z"),
            proofs: [
              { factor: "GPS", valid: true },
              { factor: "CODE_DOMICILE", valid: true },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("Visite vérifiée.")).toBeInTheDocument();
    expect(screen.getByText(/Position vérifiée\. Code du domicile correct\./)).toBeInTheDocument();
    expect(screen.getByText(/2 preuves sur 3/)).toBeInTheDocument();
  });

  it("met en avant le signal « à surveiller » et précise qu'il n'est pas médical", () => {
    render(<KayeCard entry={{ ...base, mood: 3, alertFlag: true, alertNote: "Moins d'entrain que d'habitude." }} />);
    expect(screen.getByText("À surveiller")).toBeInTheDocument();
    expect(screen.getByText("Moins d'entrain que d'habitude.")).toBeInTheDocument();
    expect(screen.getByText(/pas une alerte médicale/)).toBeInTheDocument();
  });
});
