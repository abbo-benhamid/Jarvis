import { describe, expect, it } from "vitest";
import { registerSchema, safeNextPath } from "./validation";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => expect(safeNextPath("/famille/kaye")).toBe("/famille/kaye"));
  it("refuse une URL externe", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
  });
});

describe("registerSchema", () => {
  const ok = {
    role: "FAMILLE",
    firstName: "Line",
    lastName: "Test",
    email: "LINE@Example.test ",
    password: "motdepasse",
    location: "HEXAGONE",
    acceptTest: "on",
    testerCode: "NADIA-07",
    acceptCgu: "on",
    adult: "on",
  };
  it("normalise l'email", () => {
    const r = registerSchema.safeParse(ok);
    expect(r.success && r.data.email).toBe("line@example.test");
  });
  it("exige le lieu de vie pour une famille", () => {
    expect(registerSchema.safeParse({ ...ok, location: undefined }).success).toBe(false);
  });
  it("exige le code testeur, les CGU de test et l'âge (D3, D4)", () => {
    expect(registerSchema.safeParse({ ...ok, testerCode: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, acceptCgu: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, adult: undefined }).success).toBe(false);
  });
  it("exige l'accord « données fictives »", () => {
    expect(registerSchema.safeParse({ ...ok, acceptTest: undefined }).success).toBe(false);
  });
});
