import { describe, expect, it } from "vitest";
import { generatePassword, validateOperatorInput } from "./operator-account";

describe("compte opérateur réel (D1)", () => {
  it("génère un mot de passe long et différent à chaque appel", () => {
    const a = generatePassword();
    expect(a).toHaveLength(24);
    expect(a).not.toBe(generatePassword());
  });
  it("valide l'email, le nom et la longueur du mot de passe", () => {
    expect(validateOperatorInput({ email: "op@koudmen.test", firstName: "Line", lastName: "K" })).toEqual([]);
    expect(validateOperatorInput({ email: "pas-un-email", firstName: "", lastName: "K", password: "court" })).toHaveLength(3);
  });
});
