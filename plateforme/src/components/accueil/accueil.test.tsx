// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HERO_KAYES, HeroScene } from "./hero-scene";
import { TUTORIAL_STEPS, VisitTutorial } from "./visit-tutorial";

/** matchMedia simulé : `reduce` dit si la personne demande moins d'animations. */
function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("reduce") ? reduce : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** IntersectionObserver simulé : tout est à l'écran tout de suite. */
class VisibleObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", VisibleObserver);
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tutorial = <VisitTutorial intro={<h2>Ce que vous recevez</h2>} receipt={<p>Reçu</p>} kaye={<p>Kayé</p>} />;

describe("HeroScene (accueil, motion)", () => {
  it("mode réduit : premier Kayé complet, pas de bouton pause, scène sans lecture", () => {
    mockReducedMotion(true);
    render(<HeroScene label="Illustration : lever de soleil" />);
    expect(screen.getByRole("img", { name: "Illustration : lever de soleil" })).toBeInTheDocument();
    expect(screen.getByTestId("hero-kaye")).toHaveTextContent(HERO_KAYES[0].text);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(`Exemple de Kayé : ${HERO_KAYES[0].text}`)).toBeInTheDocument();
  });

  it("animations permises : le texte s'écrit, puis le bouton pause fige la scène avec le texte complet", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(<HeroScene label="Illustration" />);
    const scene = screen.getByRole("figure");
    expect(scene).toHaveAttribute("data-play", "true");
    // Pendant l'entrée, la carte est vide ; puis le texte s'écrit lettre par lettre.
    // Chaque lettre est une minuterie qui dépend du rendu précédent : on avance pas à pas.
    for (const ms of [2100, 120, 34, 34, 34, 34]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    }
    // La phrase complète n'existe qu'une fois (copie invisible qui réserve la hauteur) : la copie visible est partielle.
    const count = () => (screen.getByTestId("hero-kaye").textContent ?? "").split(HERO_KAYES[0].text).length - 1;
    expect(count()).toBe(1);
    const typed = (screen.getByTestId("hero-kaye").textContent ?? "").split(HERO_KAYES[2].text)[1] ?? "";
    expect(typed.length).toBeGreaterThan(0);
    expect(HERO_KAYES[0].text.startsWith(typed)).toBe(true);
    vi.useRealTimers();
    const pause = screen.getByRole("button", { name: "Mettre l'animation en pause" });
    await userEvent.click(pause);
    expect(pause).toHaveAttribute("aria-pressed", "true");
    expect(scene).toHaveAttribute("data-play", "false");
    expect(count()).toBe(2);
  });
});

describe("VisitTutorial (accueil, motion)", () => {
  it("3 étapes numérotées dans l'ordre", () => {
    mockReducedMotion(true);
    render(tutorial);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(TUTORIAL_STEPS.map((s, n) => `${n + 1}${n + 1}. ${s.title}${s.text}`));
  });

  it("mode réduit : tout est visible (pas de data-stage), pas de bouton « Revoir »", () => {
    mockReducedMotion(true);
    render(tutorial);
    expect(screen.getByTestId("tutoriel-scene")).not.toHaveAttribute("data-stage");
    expect(screen.queryByRole("button", { name: /Revoir/ })).toBeNull();
  });

  it("animations permises : la scène joue jusqu'au Kayé, l'étape en cours est marquée, « Revoir » rejoue", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(tutorial);
    const scene = screen.getByTestId("tutoriel-scene");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(scene).toHaveAttribute("data-stage", "1");
    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(scene).toHaveAttribute("data-stage", "4");
    expect(screen.getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");
    await act(async () => {
      screen.getByRole("button", { name: /Revoir/ }).click();
    });
    expect(scene).toHaveAttribute("data-stage", "0");
  });
});
