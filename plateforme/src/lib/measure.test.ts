import { describe, expect, it } from "vitest";
import { isValidMicroAnswer, MICRO_QUESTION_KEYS, MICRO_QUESTIONS, microAnswerLabel } from "./measure";

describe("micro-questions (D15)", () => {
  it("définit 4 questions avec des choix", () => {
    expect(MICRO_QUESTION_KEYS).toHaveLength(4);
    for (const k of MICRO_QUESTION_KEYS) expect(MICRO_QUESTIONS[k].choices.length).toBeGreaterThan(1);
  });
  it("refuse une question ou une réponse inconnue", () => {
    expect(isValidMicroAnswer("KAYE_RASSURE", "5")).toBe(true);
    expect(isValidMicroAnswer("KAYE_RASSURE", "9")).toBe(false);
    expect(isValidMicroAnswer("INCONNUE", "OUI")).toBe(false);
  });
  it("donne le libellé d'une réponse", () => {
    expect(microAnswerLabel("PRIX_TROP_CHER", "20_39")).toBe("20 à 39 €");
  });
});
