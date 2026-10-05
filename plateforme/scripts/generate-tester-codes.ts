/**
 * Génère des codes testeurs ALÉATOIRES (B1), à copier dans TESTER_INVITE_CODES sur Vercel.
 *   pnpm ops:generate-codes            → 10 codes
 *   pnpm ops:generate-codes 25         → 25 codes
 * Format : T-XXXX-XXXX-XXXX (12 caractères aléatoires, alphabet sans caractères ambigus).
 * Un code par testeur. Jamais de code dans le dépôt.
 */
import { generateTesterCode } from "../src/server/tester-codes";

const n = Math.min(Math.max(Number(process.argv[2] ?? 10) || 10, 1), 500);
console.log(Array.from({ length: n }, () => generateTesterCode()).join(","));
