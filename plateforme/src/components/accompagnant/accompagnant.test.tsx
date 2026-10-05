// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { isVisitScreen } from "./accompagnant-nav";
import { VisitProofBadge, kayeIsDue } from "./visit-display";
import { InstallPrompt } from "./install-prompt";

describe("W4 — espace accompagnant", () => {
  it("masque la barre basse seulement sur l'écran de visite et son Kayé", () => {
    expect(isVisitScreen("/accompagnant/visites/abc")).toBe(true);
    expect(isVisitScreen("/accompagnant/visites/abc/kaye")).toBe(true);
    expect(isVisitScreen("/accompagnant/visites")).toBe(false);
    expect(isVisitScreen("/accompagnant")).toBe(false);
    expect(isVisitScreen("/accompagnant/profil")).toBe(false);
  });

  it("dit l'état de la preuve par un mot, pas par la couleur seule", () => {
    const { rerender } = render(<VisitProofBadge score={1} />);
    expect(screen.getByText("Preuves 1 sur 2")).toBeTruthy();
    rerender(<VisitProofBadge score={2} />);
    expect(screen.getByText("Prouvée")).toBeTruthy();
  });

  it("signale un Kayé à écrire après l'arrivée seulement", () => {
    expect(kayeIsDue({ checkInAt: new Date(), journal: null })).toBe(true);
    expect(kayeIsDue({ checkInAt: null, journal: null })).toBe(false);
    expect(kayeIsDue({ checkInAt: new Date(), journal: { id: "k" } })).toBe(false);
  });

  it("n'affiche jamais l'invite d'installation sans action réussie", () => {
    const { container } = render(<InstallPrompt show={false} />);
    expect(container.textContent).toBe("");
  });
});
