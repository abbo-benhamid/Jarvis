import type { Plan } from "@prisma/client";
import { monthlyCostExample, type MonthlyCostExample } from "./estimates";

/**
 * Formules (D5 : une seule grille). Paiement SIMULÉ dans le MVP : aucun vrai prélèvement.
 * A2 : « Lakou » désigne SEULEMENT le cercle familial. La formule gratuite s'appelle « Libre »
 * (la valeur d'enum Prisma reste LAKOU, elle n'est jamais affichée).
 * « Veyé » est réservé au mode cyclone Veyé Siklòn : la formule d'appel s'appelle « Kozé ».
 */
export type PlanInfo = {
  plan: Plan;
  name: string;
  priceCents: number;
  priceLabel: string;
  audience: string;
  /** Sens du nom, en une phrase (A11). */
  meaning: string;
  features: string[];
  /** A3 : exemple de coût mensuel total (abonnement + heures − crédit d'impôt sur les heures). */
  example: { label: string; cost: MonthlyCostExample };
};

/** Mention obligatoire sur chaque affichage des formules (T6). */
export const OFFER_TEST_NOTICE = "Tarifs de lancement · ouverture prochaine.";

/**
 * R8 (J32) : aucun paiement en ligne. Une formule payante = une demande de RAPPEL par un conseiller.
 * Texte de la critique juridique § 5.5.
 */
export const NO_PAYMENT_NOTICE = "Aucun paiement n'est demandé aujourd'hui. Un conseiller vous appelle pour vous expliquer. Vous ne vous engagez à rien.";

/** R8 (J33) : deux lignes de prix, mention fiscale exacte. [À VÉRIFIER par rescrit] éligibilité de l'abonnement. */
export function priceLines(plan: PlanInfo): { subscription: string; hours: string } {
  return {
    subscription:
      plan.priceCents === 0
        ? "Abonnement Koudmen : 0 €. Services numériques."
        : `Abonnement Koudmen : ${plan.priceLabel.replace("par mois", "TTC par mois")}. Services numériques. Non éligible au crédit d'impôt.`,
    hours: "Heures d'accompagnement : payées à part à l'accompagnant. Crédit d'impôt de 50 % si les conditions sont remplies.",
  };
}

export const PLANS: readonly PlanInfo[] = [
  {
    plan: "LAKOU",
    name: "Libre",
    priceCents: 0,
    priceLabel: "0 € par mois",
    audience: "Pour tout le cercle familial",
    meaning: "Gratuit, sans engagement.",
    features: ["Le cercle Lakou : vos proches lisent les nouvelles", "La fiche de l'aîné", "Le Kayé partagé"],
    example: { label: "Avec 2 visites de 2 h par mois", cost: monthlyCostExample(0, 2) },
  },
  {
    plan: "KOZE",
    name: "Kozé",
    priceCents: 3900,
    priceLabel: "39 € par mois",
    audience: "Pour la famille à distance",
    meaning: "« Kozé » veut dire « causer » en créole : Koudmen appelle l'aîné chaque semaine.",
    features: ["Tout Libre", "Un appel chaque semaine à l'aîné", "Des alertes par WhatsApp ou SMS"],
    example: { label: "Avec 2 visites de 2 h par mois", cost: monthlyCostExample(3900, 2) },
  },
  {
    plan: "SERENITE",
    name: "Sérénité",
    // [À VÉRIFIER] Modèle réel de Sérénité (S1-arbitrage, « reporté avant le pilote »).
    priceCents: 14900,
    priceLabel: "dès 149 € par mois",
    audience: "Un suivi renforcé, avec preuve",
    // R8 (J34) : aucun volume de visites promis, aucune garantie de remplacement. Koudmen met en relation.
    meaning: "Koudmen suit de près les visites que vous organisez avec l'accompagnant choisi, et vous montre la preuve de chaque visite.",
    features: [
      "Tout Kozé",
      "Un conseiller Koudmen dédié",
      "Une preuve à chaque visite (2 preuves sur 3)",
      "Un point avec vous chaque mois",
    ],
    example: { label: "Avec 4 visites de 2 h par mois", cost: monthlyCostExample(14900, 4) },
  },
] as const;

export function getPlan(plan: Plan): PlanInfo {
  const p = PLANS.find((x) => x.plan === plan);
  if (!p) throw new Error(`Formule inconnue : ${plan}`);
  return p;
}
