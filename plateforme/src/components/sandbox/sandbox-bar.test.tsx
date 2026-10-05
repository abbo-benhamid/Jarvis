// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScenarioEndPrompt } from "./scenario-end";
import { PanelDisclosure } from "./panel-disclosure";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const scenarios = [
  { id: "s1", title: "1. Des nouvelles de Léonie", done: true },
  { id: "s2", title: "2. Une visite prouvée", done: false },
];

describe("ScenarioEndPrompt", () => {
  it("s'affiche une seule fois par scénario terminé", () => {
    const first = render(<ScenarioEndPrompt sandboxId="sb" scenarios={scenarios} />);
    expect(screen.getByText("Scénario terminé : Des nouvelles de Léonie")).toBeTruthy();
    first.unmount();
    // Nouvelle page : l'invite ne revient pas.
    render(<ScenarioEndPrompt sandboxId="sb" scenarios={scenarios} />);
    expect(screen.queryByText(/Scénario terminé/)).toBeNull();
  });

  it("« Plus tard » ferme l'invite", () => {
    render(<ScenarioEndPrompt sandboxId="sb2" scenarios={scenarios} />);
    fireEvent.click(screen.getByRole("button", { name: "Plus tard" }));
    expect(screen.queryByText(/Scénario terminé/)).toBeNull();
  });
});

describe("PanelDisclosure", () => {
  it("« Détails » déplie les scénarios avec aria-expanded", () => {
    render(<PanelDisclosure status={<p>Test 1/10</p>} actions={null} details={<p>Les 3 scénarios</p>} />);
    const button = screen.getByRole("button", { name: /^Détails/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Les 3 scénarios").closest("[hidden]")).not.toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Les 3 scénarios").closest("[hidden]")).toBeNull();
  });
});
