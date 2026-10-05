// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeCode } from "./home-code";

afterEach(cleanup);

describe("HomeCode (arbitrage V1 X3)", () => {
  it("même code en clair ET en QR (koudmen:domicile:<code>), scanner ou saisir", () => {
    const { container } = render(<HomeCode code="LKW7Q3" aineFirstName="Léonie" />);
    expect(screen.getByText("LKW7Q3")).toBeTruthy();
    const qr = screen.getByRole("img", { name: /QR code du domicile/ });
    expect(qr.getAttribute("data-qr-contenu")).toBe("koudmen:domicile:LKW7Q3");
    expect(container.querySelector("svg[data-qr-contenu] path")?.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(screen.getByText(/scanne le QR code ou saisit le code/)).toBeTruthy();
  });
});
