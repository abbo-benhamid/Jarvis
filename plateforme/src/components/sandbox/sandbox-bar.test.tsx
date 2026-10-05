// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScenarioEndPrompt } from "./scenario-end";
import { PanelDisclosure } from "./panel-disclosure";
import { SandboxPanelFrame, isWorkScreen } from "./sandbox-panel-frame";
import { toTopAndFocusTitle } from "@/components/layout/arrival-focus";

const nav = vi.hoisted(() => ({ pathname: "/famille" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

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

describe("SandboxPanelFrame (UX V1 M2, X8)", () => {
  it("écrans de travail : fiche visite et Kayé de l'accompagnant seulement", () => {
    expect(isWorkScreen("/accompagnant/visites/cmv1")).toBe(true);
    expect(isWorkScreen("/accompagnant/visites/cmv1/kaye")).toBe(true);
    expect(isWorkScreen("/accompagnant/visites")).toBe(false);
    expect(isWorkScreen("/accompagnant")).toBe(false);
    expect(isWorkScreen("/famille")).toBe(false);
  });

  it("écran de travail : une pastille « Mode test · 6/9 » qui déplie le panneau ; libellé du panneau masqué", () => {
    nav.pathname = "/accompagnant/visites/cmv1";
    render(
      <SandboxPanelFrame progress="6/9">
        <section aria-label="Votre test">
          <strong className="group-data-[compact=true]:hidden">Mode test</strong> 6/9
        </section>
      </SandboxPanelFrame>,
    );
    const pill = screen.getByRole("button", { name: /^Mode test · 6\/9/ });
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByLabelText("Votre test").closest("[hidden]")).not.toBeNull();
    fireEvent.click(pill);
    expect(pill.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Votre test").closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText("Votre test").closest("[data-compact='true']")).not.toBeNull();
  });

  it("écran normal : le panneau complet, sans pastille", () => {
    nav.pathname = "/famille";
    render(
      <SandboxPanelFrame progress="1/10">
        <section aria-label="Votre test">Panneau</section>
      </SandboxPanelFrame>,
    );
    expect(screen.queryByRole("button", { name: /Mode test/ })).toBeNull();
    expect(screen.getByText("Panneau")).toBeTruthy();
  });
});

describe("ArrivalFocus (UX V1 M1)", () => {
  it("remonte en haut de page et met le focus sur le h1", () => {
    document.body.innerHTML = "<main><h1>Bonjou, Nadia</h1></main>";
    const scrollTo = vi.fn();
    toTopAndFocusTitle({ scrollTo } as unknown as Window, document);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    const h1 = document.querySelector("h1")!;
    expect(h1.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(h1);
  });
});
