/**
 * Mesure du test (D15) : micro-questions contextuelles et offre factice. Importable client et serveur.
 */

export type MicroChoice = { value: string; label: string };
export type MicroQuestion = { key: MicroQuestionKey; question: string; choices: MicroChoice[] };

export const MICRO_QUESTION_KEYS = ["KAYE_RASSURE", "PREUVE_COMPRISE", "PRIX_TROP_CHER", "INSCRIPTION_REELLE"] as const;
export type MicroQuestionKey = (typeof MICRO_QUESTION_KEYS)[number];

/** Les 4 micro-questions, posées une fois, au bon moment. */
export const MICRO_QUESTIONS: Record<MicroQuestionKey, MicroQuestion> = {
  KAYE_RASSURE: {
    key: "KAYE_RASSURE",
    question: "Ce Kayé vous rassure-t-il ?",
    choices: [
      { value: "1", label: "1 · Pas du tout" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5 · Tout à fait" },
    ],
  },
  PREUVE_COMPRISE: {
    key: "PREUVE_COMPRISE",
    question: "Comprenez-vous comment Koudmen prouve qu'une visite a eu lieu ?",
    choices: [
      { value: "OUI", label: "Oui" },
      { value: "PAS_VRAIMENT", label: "Pas vraiment" },
      { value: "NON", label: "Non" },
    ],
  },
  PRIX_TROP_CHER: {
    key: "PRIX_TROP_CHER",
    question: "À partir de quel prix par mois Koudmen serait-il trop cher pour vous ?",
    choices: [
      { value: "MOINS_20", label: "Moins de 20 €" },
      { value: "20_39", label: "20 à 39 €" },
      { value: "40_79", label: "40 à 79 €" },
      { value: "80_149", label: "80 à 149 €" },
      { value: "150_PLUS", label: "150 € ou plus" },
    ],
  },
  INSCRIPTION_REELLE: {
    key: "INSCRIPTION_REELLE",
    question: "Vous inscririez-vous pour de vrai sur Koudmen ?",
    choices: [
      { value: "OUI", label: "Oui" },
      { value: "PEUT_ETRE", label: "Peut-être" },
      { value: "NON", label: "Non" },
    ],
  },
};

export function isValidMicroAnswer(key: string, answer: string): key is MicroQuestionKey {
  const q = MICRO_QUESTIONS[key as MicroQuestionKey];
  return Boolean(q && q.choices.some((c) => c.value === answer));
}

export function microAnswerLabel(key: string, answer: string): string {
  return MICRO_QUESTIONS[key as MicroQuestionKey]?.choices.find((c) => c.value === answer)?.label ?? answer;
}

/** Texte EXACT de la case de consentement (gardé avec la demande, comme preuve). */
export const DISCOVERY_CONSENT_TEXT =
  "J'accepte que Koudmen garde mon prénom et mon contact pour me recontacter au sujet d'une vraie visite découverte. Je peux retirer mon accord à tout moment en écrivant à l'équipe.";

/** Prix affiché de l'offre factice (porte d'engagement). [À VÉRIFIER] prix réel. */
export const DISCOVERY_PRICE_LABEL = "49 €";
