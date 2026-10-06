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
    audience: "Des visites régulières, avec preuve",
    meaning: "Koudmen organise une visite chaque semaine et la prouve.",
    features: [
      "Tout Kozé",
      "Une visite organisée chaque semaine (heures payées à part)",
      "Une preuve à chaque visite (2 preuves sur 3)",
      "De l'aide pour trouver un remplaçant (sans garantie)",
    ],
    example: { label: "Avec 4 visites de 2 h par mois", cost: monthlyCostExample(14900, 4) },
  },
] as const;

export function getPlan(plan: Plan): PlanInfo {
  const p = PLANS.find((x) => x.plan === plan);
  if (!p) throw new Error(`Formule inconnue : ${plan}`);
  return p;
}
