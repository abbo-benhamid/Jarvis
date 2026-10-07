import { describe, expect, it } from "vitest";
import { COMMON_PASSWORD_COUNT, PASSWORD_MIN, passwordProblem } from "./password-policy";

describe("politique des mots de passe (L1)", () => {
  it("accepte un mot de passe long et peu courant", () => {
    expect(passwordProblem("Zebre-Lagon-2026")).toBeNull();
    expect(passwordProblem("le manguier de grand-mère")).toBeNull();
  });

  it("10 caractères minimum, 128 maximum", () => {
    expect(PASSWORD_MIN).toBe(10);
    expect(passwordProblem("Abc-12345")).toBe("10 caractères minimum.");
    expect(passwordProblem("a".repeat(5) + "B".repeat(124))).toBe("128 caractères maximum.");
  });

  it("refuse les mots de passe courants, même avec des chiffres ou des signes à la fin", () => {
    for (const pw of ["motdepasse", "1234567890", "azertyuiop", "Martinique972", "MotDePasse123!", "Madinina2026", "Koudmen2026!!", "jetaime123"]) {
      expect(passwordProblem(pw), pw).toBe("Ce mot de passe est trop courant. Choisissez-en un autre.");
    }
    expect(COMMON_PASSWORD_COUNT).toBeGreaterThan(90);
  });

  it("refuse un mot de passe d'un ou deux caractères répétés", () => {
    expect(passwordProblem("aaaaaaaaaaaa")).not.toBeNull();
    expect(passwordProblem("abababababab")).not.toBeNull();
  });

  it("refuse un mot de passe qui reprend l'e-mail ou le nom", () => {
    expect(passwordProblem("josiane2026", { email: "josiane@exemple.test" })).toBe("Le mot de passe ne doit pas reprendre votre nom ou votre e-mail.");
    expect(passwordProblem("Lafleur!!!!", { lastName: "Lafleur" })).toBe("Le mot de passe ne doit pas reprendre votre nom ou votre e-mail.");
    expect(passwordProblem("Josiane-sous-le-manguier", { firstName: "Josiane" })).toBeNull();
  });
});
