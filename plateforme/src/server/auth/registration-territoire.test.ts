import { describe, expect, it } from "vitest";
import { registrationProblem, type RegistrationInput } from "./registration";

const NOW = new Date("2026-10-09T12:00:00Z");
const base: RegistrationInput = {
  role: "ACCOMPAGNANT",
  firstName: "Rose",
  lastName: "Lafleur",
  email: "rose@exemple.test",
  password: "Zebre-Lagon-2026",
  phone: "+33 6 12 34 56 78",
  commune: "POINTE_A_PITRE",
  location: null,
  city: null,
  birthDate: "1990-04-02",
  newsOptIn: false,
  via: "api",
};

describe("T1 : inscription d'un accompagnant et territoire", () => {
  it("accepte une commune de Guadeloupe (territoire ouvert), territoire déduit ou donné ; numéro libre", () => {
    expect(registrationProblem(base, NOW)).toBeNull();
    expect(registrationProblem({ ...base, territoire: "GUADELOUPE", commune: "LAMENTIN_GP" }, NOW)).toBeNull();
  });

  it("refuse une zone dans un territoire « Bientôt », avec un message qui propose la liste d'attente", () => {
    const r = registrationProblem({ ...base, commune: "FORT_DE_FRANCE" }, NOW);
    expect(r).toMatchObject({ ok: false, field: "commune" });
    expect(r && !r.ok && r.message).toMatch(/pas encore ouvert en Martinique.*liste d'attente/);
  });

  it("refuse une commune hors du territoire choisi, et une commune inconnue", () => {
    expect(registrationProblem({ ...base, territoire: "MARTINIQUE" }, NOW)).toMatchObject({ ok: false, field: "commune", message: "Cette commune n'est pas dans le territoire choisi." });
    expect(registrationProblem({ ...base, commune: "CAYENNE" }, NOW)).toMatchObject({ ok: false, field: "commune" });
  });

  it("une famille de la diaspora (Hexagone) s'inscrit sans commune (T3)", () => {
    expect(registrationProblem({ ...base, role: "FAMILLE", commune: null, location: "HEXAGONE", birthDate: null }, NOW)).toBeNull();
  });
});
