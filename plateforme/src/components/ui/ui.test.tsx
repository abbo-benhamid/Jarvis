// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/famille/kaye/123" }));

import { Avatar, initialOf } from "./avatar";
import { ProofBadge } from "./badge";
import { BottomNav, isActiveTab } from "./bottom-nav";
import { Button, buttonClasses } from "./button";
import { PlanRadio, PLAN_NOTICE } from "./plan-radio";
import { StatusCard } from "./status-card";
import { Switch } from "./switch";
import { receiptVerdict, VisitReceipt } from "./visit-receipt";

describe("Button", () => {
  it("garde les variantes historiques et la cible de 44 px", () => {
    for (const v of ["primary", "secondary", "ghost", "danger", "soleil", "ink", "quiet", "link"] as const) {
      expect(buttonClasses(v, "md")).toContain("min-h-11");
    }
    expect(buttonClasses("primary", "lg")).toContain("min-h-14");
    expect(buttonClasses("primary", "lg", undefined, true)).toContain("w-full");
  });

  it("rend un bouton de type button par défaut, icône décorative", () => {
    render(<Button icon={<svg data-testid="ico" />}>Commencer</Button>);
    const b = screen.getByRole("button", { name: "Commencer" });
    expect(b).toHaveAttribute("type", "button");
    expect(screen.getByTestId("ico").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Avatar", () => {
  it("prend la première lettre, accents compris", () => {
    expect(initialOf("élise")).toBe("É");
    expect(initialOf("  Léonie")).toBe("L");
  });

  it("met l'anneau madras sur l'aîné seulement", () => {
    const { container } = render(
      <>
        <Avatar name="Léonie" role="aine" />
        <Avatar name="Josiane" role="accompagnant" />
      </>,
    );
    expect(container.querySelectorAll(".kd-madras-ring")).toHaveLength(1);
  });
});

describe("ProofBadge", () => {
  it("écrit toujours le mot (pas de couleur seule)", () => {
    render(<ProofBadge />);
    expect(screen.getByText("Prouvée")).toBeInTheDocument();
  });
});

describe("StatusCard", () => {
  it("dit l'état en titre et les chiffres en liste de définitions", () => {
    render(
      <StatusCard
        label="État de Léonie"
        name="Léonie"
        lead="Elle va"
        word="bien."
        stats={[{ value: "2/3", label: "preuves samedi" }]}
      />,
    );
    expect(screen.getByRole("region", { name: "État de Léonie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elle va bien." })).toBeInTheDocument();
    expect(screen.getByText("preuves samedi").tagName).toBe("DT");
  });
});

describe("VisitReceipt", () => {
  it("valide la visite à partir de 2 preuves sur 3", () => {
    expect(receiptVerdict([{ obtained: true }, { obtained: true }, { obtained: false }])).toEqual({
      valid: true,
      title: "2 preuves sur 3 · visite validée",
    });
    expect(receiptVerdict([{ obtained: true }, { obtained: false }, { obtained: false }]).title).toBe("1 preuve sur 3 · à vérifier");
  });

  it("annonce chaque preuve obtenue ou manquante", () => {
    render(
      <VisitReceipt
        times={[{ label: "Arrivée", value: "10:04" }]}
        proofs={[
          { label: "Position", obtained: true },
          { label: "Appel", obtained: false },
        ]}
      />,
    );
    expect(screen.getByText("Preuve obtenue :")).toBeInTheDocument();
    expect(screen.getByText("Preuve manquante :")).toBeInTheDocument();
  });
});

describe("BottomNav", () => {
  it("marque l'onglet de la page courante", () => {
    expect(isActiveTab("/famille", "/famille", true)).toBe(true);
    expect(isActiveTab("/famille/kaye", "/famille", true)).toBe(false);
    render(
      <BottomNav
        items={[
          { href: "/famille", label: "Accueil", icon: <svg />, exact: true },
          { href: "/famille/kaye", label: "Kayé", icon: <svg /> },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Kayé" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });
});

describe("PlanRadio", () => {
  it("utilise des radios natives et affiche la mention d'offre en test", async () => {
    const onValueChange = vi.fn();
    render(
      <PlanRadio
        name="formule"
        legend="Formules"
        defaultValue="libre"
        onValueChange={onValueChange}
        options={[
          { value: "libre", name: "Libre", price: "0 €" },
          { value: "serenite", name: "Sérénité", price: "149 €", features: ["Une visite par semaine"] },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Formules" })).toBeInTheDocument();
    expect(screen.getByText(PLAN_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText("Une visite par semaine")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Sérénité/ }));
    expect(screen.getByRole("radio", { name: /Sérénité/ })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledWith("serenite");
    expect(screen.getByText("Une visite par semaine")).toBeInTheDocument();
  });
});

describe("Switch", () => {
  it("bascule aria-checked et envoie la valeur avec le formulaire", async () => {
    const { container } = render(<Switch label="Partager le paiement" name="partage" />);
    const s = screen.getByRole("switch", { name: "Partager le paiement" });
    expect(s).toHaveAttribute("aria-checked", "false");
    await userEvent.click(s);
    expect(s).toHaveAttribute("aria-checked", "true");
    expect(container.querySelector('input[name="partage"]')).toHaveValue("on");
  });
});
