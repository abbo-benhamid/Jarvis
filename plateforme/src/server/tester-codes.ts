import { randomInt } from "node:crypto";
import { testerCodeProblem } from "./config-check";

/** Alphabet sans caractères ambigus (0/O, 1/I/L) et sans « E » (évite le marqueur « E2E »). */
const ALPHABET = "ABCDFGHJKMNPQRSTUVWXYZ23456789";

/** Code testeur aléatoire (B1) : T-XXXX-XXXX-XXXX, soit 12 caractères tirés par un aléa cryptographique (≈ 59 bits). */
export function generateTesterCode(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  for (;;) {
    const code = `T-${group()}-${group()}-${group()}`;
    if (testerCodeProblem(code) === null) return code;
  }
}
