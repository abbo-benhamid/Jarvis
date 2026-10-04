import type { Plan } from "@prisma/client";

/**
 * Formules (D5 : une seule grille). Paiement SIMULÉ dans le MVP : aucun vrai prélèvement.
 * « Veyé » est réservé au mode cyclone Veyé Siklòn : la formule d'appel s'appelle « Kozé ».
 */
export type PlanInfo = {
  plan: Plan;
  name: string;
  priceCents: number;
  priceLabel: string;
  audience: string;
  features: string[];
};

/** Mention obligatoire sur chaque affichage des formules (T6). */
export const OFFER_TEST_NOTICE = "Offre en test, non commercialisée. Prix et contenu à l'étude.";

export const PLANS: readonly PlanInfo[] = [
  {
    plan: "LAKOU",
    name: "Lakou",
    priceCents: 0,
    priceLabel: "0 € / mois",
    audience: "Pour tout le cercle familial",
    features: ["Cercle familial Lakou", "Fiche de l'aîné", "Journal Kayé partagé"],
  },
  {
    plan: "KOZE",
    name: "Kozé",
    priceCents: 3900,
    priceLabel: "39 € / mois",
    audience: "Pour la famille à distance",
    features: ["Tout Lakou", "Appel hebdomadaire à l'aîné", "Alertes WhatsApp ou SMS"],
  },
  {
    plan: "SERENITE",
    name: "Sérénité",
    // [À VÉRIFIER] Modèle réel de Sérénité (S1-arbitrage, « reporté avant le pilote »).
    priceCents: 14900,
    priceLabel: "dès 149 € / mois",
    audience: "Visites régulières avec preuve",
    features: [
      "Tout Kozé",
      "1 visite par semaine",
      "Preuve de visite 2 sur 3",
      "Aide pour trouver un remplaçant (sans garantie)",
    ],
  },
] as const;

export function getPlan(plan: Plan): PlanInfo {
  const p = PLANS.find((x) => x.plan === plan);
  if (!p) throw new Error(`Formule inconnue : ${plan}`);
  return p;
}
