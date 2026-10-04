import type { Plan } from "@prisma/client";

/** Formules (docs/00 § 3). Paiement SIMULÉ dans le MVP : aucun vrai prélèvement. */
export type PlanInfo = {
  plan: Plan;
  name: string;
  priceCents: number;
  priceLabel: string;
  audience: string;
  features: string[];
};

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
    plan: "VEYE",
    name: "Veyé",
    priceCents: 3900,
    priceLabel: "39 € / mois",
    audience: "Pour la famille à distance",
    features: ["Tout Lakou", "Appel hebdomadaire de veille", "Alertes WhatsApp ou SMS"],
  },
  {
    plan: "SERENITE",
    name: "Sérénité",
    // [À VÉRIFIER] 00 § 3 : 19,90 €/mois + frais, ou forfait 149 à 199 €. MVP : forfait 149 € affiché.
    priceCents: 14900,
    priceLabel: "à partir de 149 € / mois",
    audience: "Visites régulières avec preuve",
    features: ["Tout Veyé", "1 visite par semaine", "Preuve de visite 2 sur 3", "Remplacement"],
  },
] as const;

export function getPlan(plan: Plan): PlanInfo {
  const p = PLANS.find((x) => x.plan === plan);
  if (!p) throw new Error(`Formule inconnue : ${plan}`);
  return p;
}
