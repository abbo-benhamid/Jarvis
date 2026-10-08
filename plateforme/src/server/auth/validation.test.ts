import { describe, expect, it } from "vitest";
import { newPasswordSchema, registerSchema, safeNextPath } from "./validation";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => expect(safeNextPath("/famille/kaye")).toBe("/famille/kaye"));
  it("refuse une URL externe", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
  });
});

describe("registerSchema (L2, R6)", () => {
  const famille = {
    role: "FAMILLE",
    firstName: "Line",
    lastName: "Test",
    email: "LINE@Example.test ",
    password: "Zebre-Lagon-2026",
    location: "HEXAGONE",
    acceptCgu: "on",
    adult: "on",
  };
  const accompagnant = {
    role: "ACCOMPAGNANT",
    firstName: "Rose",
    lastName: "Test",
    email: "rose@example.test",
    password: "Zebre-Lagon-2026",
    phone: "+596 696 12 34 56",
    commune: "FORT_DE_FRANCE",
    birthDate: "1990-04-02",
    acceptCgu: "on",
  };
  it("normalise l'email", () => {
    const r = registerSchema.safeParse(famille);
    expect(r.success && r.data.email).toBe("line@example.test");
  });
  it("D6 : refuse une URL, des chiffres ou plus de 40 caractères dans le prénom et le nom", () => {
    expect(registerSchema.safeParse({ ...famille, firstName: "Votre accès est bloqué, appelez le 0696 00 00 00" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...famille, firstName: "http://piege.example" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...famille, lastName: "x".repeat(41) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...famille, firstName: "Marie-Josée", lastName: "D'Alembert" }).success).toBe(true);
  });
  it("famille : exige le lieu de vie et la déclaration d'âge", () => {
    expect(registerSchema.safeParse({ ...famille, location: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...famille, adult: undefined }).success).toBe(false);
  });
  it("accompagnant : exige téléphone, commune et date de naissance", () => {
    expect(registerSchema.safeParse(accompagnant).success).toBe(true);
    for (const k of ["phone", "commune", "birthDate"] as const) {
      expect(registerSchema.safeParse({ ...accompagnant, [k]: "" }).success).toBe(false);
    }
  });
  it("CGU obligatoires ; pas de case « confidentialité » ; e-mails d'information facultatifs", () => {
    expect(registerSchema.safeParse({ ...famille, acceptCgu: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...famille, newsOptIn: "on" }).success).toBe(true);
    expect(registerSchema.safeParse(famille).success).toBe(true);
  });
  it("mot de passe : 10 caractères minimum", () => {
    expect(registerSchema.safeParse({ ...famille, password: "court-123" }).success).toBe(false);
  });
  it("le code testeur n'est plus demandé (L2 : inscription ouverte)", () => {
    expect(registerSchema.safeParse({ ...famille, testerCode: undefined }).success).toBe(true);
  });
});

describe("newPasswordSchema", () => {
  it("exige deux saisies identiques", () => {
    expect(newPasswordSchema.safeParse({ token: "kp1_xxxxxxxxxxxx", password: "Zebre-Lagon-2026", confirm: "Zebre-Lagon-2027" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ token: "kp1_xxxxxxxxxxxx", password: "Zebre-Lagon-2026", confirm: "Zebre-Lagon-2026" }).success).toBe(true);
  });
});
