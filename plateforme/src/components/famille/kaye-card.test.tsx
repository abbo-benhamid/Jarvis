// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KayeEntryDetail, KayePreview, receiptProofs, type KayeEntry } from "./kaye-card";
import { aineStatus } from "./status";

const base: KayeEntry = {
  id: "ckaye000000000001",
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

const validated: KayeEntry = {
  ...base,
  visit: {
    ...base.visit,
    status: "VALIDEE",
    checkInAt: new Date("2026-09-06T13:02:00Z"),
    proofs: [
      { factor: "GPS", valid: true },
      { factor: "CODE_DOMICILE", valid: true },
    ],
  },
};

describe("KayePreview (fil du Kayé)", () => {
  it("montre la phrase d'humeur, la note, l'auteur et mène au détail", () => {
    render(<KayePreview entry={validated} now={new Date("2026-09-07T12:00:00Z")} />);
    expect(screen.getByText("Léonie allait bien.")).toBeInTheDocument();
    expect(screen.getByText(/marché jusqu'à la Savane/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Josiane · hier/ })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/famille/kaye/ckaye000000000001");
    expect(screen.getByText("Prouvée")).toBeInTheDocument();
  });

  it("signale « À surveiller » avec un mot, pas seulement une couleur", () => {
    render(<KayePreview entry={{ ...base, alertFlag: true }} />);
    expect(screen.getByText("À surveiller")).toBeInTheDocument();
    expect(screen.getByText("En attente")).toBeInTheDocument();
  });
});

describe("KayeEntryDetail (détail et reçu)", () => {
  it("affiche l'humeur en texte, les activités, l'appétit et le reçu 2 sur 3", () => {
    render(<KayeEntryDetail entry={validated} />);
    expect(screen.getByRole("heading", { name: "Léonie allait bien." })).toBeInTheDocument();
    expect(screen.getByText("Humeur : bien (4 sur 5)")).toBeInTheDocument();
    expect(screen.getByText("Promenade")).toBeInTheDocument();
    expect(screen.getByText("Bon")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Reçu de visite" })).toBeInTheDocument();
    expect(screen.getByText("2 preuves sur 3 · visite validée")).toBeInTheDocument();
    expect(screen.queryByText("À surveiller")).not.toBeInTheDocument();
  });

  it("dit qu'une visite à vérifier ne demande rien à la famille", () => {
    render(<KayeEntryDetail entry={{ ...validated, visit: { ...validated.visit, status: "A_VERIFIER", proofs: [{ factor: "GPS", valid: true }] } }} />);
    expect(screen.getByText("1 preuve sur 3 · à vérifier")).toBeInTheDocument();
    expect(screen.getByText(/Vous n'avez rien à faire/)).toBeInTheDocument();
  });

  it("met en avant le signal « à surveiller » et précise qu'il n'est pas médical", () => {
    render(<KayeEntryDetail entry={{ ...base, mood: 3, alertFlag: true, alertNote: "Moins d'entrain que d'habitude." }} />);
    expect(screen.getByText("À surveiller")).toBeInTheDocument();
    expect(screen.getByText("Moins d'entrain que d'habitude.")).toBeInTheDocument();
    expect(screen.getByText(/pas une alerte médicale/)).toBeInTheDocument();
  });
});

describe("receiptProofs et aineStatus", () => {
  it("garde l'ordre des 3 preuves et marque les absentes", () => {
    const rows = receiptProofs([{ factor: "CONFIRMATION_AINE", valid: false }], "Léonie");
    expect(rows.map((r) => r.label)).toEqual(["Position au domicile", "Code du domicile", "Appel de confirmation"]);
    expect(rows.map((r) => r.obtained)).toEqual([false, false, false]);
    expect(rows[2]?.detail).toBe("Léonie n'a pas confirmé");
  });

  it("n'utilise jamais le ton « alerte » (hibiscus)", () => {
    for (const mood of [1, 2, 3, 4, 5]) {
      for (const alertFlag of [false, true]) expect(aineStatus("Léonie", { mood, alertFlag }).tone).not.toBe("alerte");
    }
    expect(aineStatus("Léonie", { mood: 5, alertFlag: false })).toMatchObject({ lead: "Léonie va", word: "bien." });
  });
});
