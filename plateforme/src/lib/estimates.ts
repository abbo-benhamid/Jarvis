import type { CaregiverStatus, Frequency } from "@prisma/client";

/**
 * Estimations affichées aux testeurs (S1b-arbitrage A3 et A4). Fonctions PURES, client et serveur.
 * Ces chiffres sont INDICATIFS. Ils servent à tester la compréhension du prix, pas à facturer.
 */

/** Exemple de référence (A3) : 4 visites de 2 heures par mois. */
export const EXAMPLE_VISITS_PER_MONTH = 4;
export const EXAMPLE_HOURS_PER_VISIT = 2;

/**
 * Coût horaire d'exemple pour la famille employeur : salaire brut d'environ 14 € + cotisations patronales,
 * après la déduction forfaitaire. [À VÉRIFIER] avec le simulateur URSSAF CESU avant le pilote.
 */
export const EXAMPLE_HOURLY_COST_CENTS = 2000;

/** Crédit d'impôt « services à la personne » : 50 % des sommes payées pour les heures. [À VÉRIFIER] plafonds. */
export const TAX_CREDIT_RATE = 0.5;

export type MonthlyCostExample = {
  subscriptionCents: number;
  visits: number;
  hours: number;
  hourlyCostCents: number;
  hoursCostCents: number;
  taxCreditCents: number;
  totalCents: number;
};

/** Coût mensuel total d'exemple : abonnement + heures − crédit d'impôt (appliqué aux heures seulement). */
export function monthlyCostExample(
  subscriptionCents: number,
  visits: number = EXAMPLE_VISITS_PER_MONTH,
  hoursPerVisit: number = EXAMPLE_HOURS_PER_VISIT,
  hourlyCostCents: number = EXAMPLE_HOURLY_COST_CENTS,
): MonthlyCostExample {
  const hours = visits * hoursPerVisit;
  const hoursCostCents = Math.round(hours * hourlyCostCents);
  const taxCreditCents = Math.round(hoursCostCents * TAX_CREDIT_RATE);
  return {
    subscriptionCents,
    visits,
    hours,
    hourlyCostCents,
    hoursCostCents,
    taxCreditCents,
    totalCents: subscriptionCents + hoursCostCents - taxCreditCents,
  };
}

/**
 * Part du tarif qui reste à l'accompagnant, selon son statut (A4).
 * - Salarié (CESU, proche aidant APA) : environ 78 % du brut (cotisations salariales). [À VÉRIFIER]
 * - Auto-entrepreneur SAP : environ 79 % du chiffre d'affaires (cotisations URSSAF de 21,2 %). [À VÉRIFIER]
 * - Bénévole : pas de revenu. SAAD : salaire fixé par la structure.
 * Avant impôt sur le revenu dans tous les cas.
 */
export const NET_SHARE_BY_STATUS: Record<CaregiverStatus, number | null> = {
  SALARIE_FAMILLE_CESU: 0.78,
  PROCHE_AIDANT_APA: 0.78,
  AUTO_ENTREPRENEUR_SAP: 0.788,
  BENEVOLE_ASSO: null,
  SAAD: null,
};

/** Revenu net estimé pour une heure, en centimes. Null si le statut ne donne pas de revenu calculable. */
export function netHourlyCents(status: CaregiverStatus | null | undefined, rateCents: number | null | undefined): number | null {
  if (!status || rateCents == null || rateCents <= 0) return null;
  const share = NET_SHARE_BY_STATUS[status];
  return share == null ? null : Math.round(rateCents * share);
}

/** Nombre de visites par mois pour une fréquence (moyenne simple). */
export const VISITS_PER_MONTH: Record<Frequency, number> = {
  PONCTUELLE: 1,
  HEBDOMADAIRE: 4,
  DEUX_PAR_SEMAINE: 8,
  QUOTIDIENNE: 30,
};

export type NetIncomeEstimate = { hourlyCents: number; perVisitCents: number; perMonthCents: number; visitsPerMonth: number };

/** Revenu net estimé d'une mission : par heure, par visite et par mois. */
export function netIncomeEstimate(
  status: CaregiverStatus | null | undefined,
  rateCents: number | null | undefined,
  durationMinutes: number,
  visitsPerMonth: number,
): NetIncomeEstimate | null {
  const hourly = netHourlyCents(status, rateCents);
  if (hourly == null) return null;
  const perVisitCents = Math.round((hourly * durationMinutes) / 60);
  return { hourlyCents: hourly, perVisitCents, perMonthCents: perVisitCents * visitsPerMonth, visitsPerMonth };
}

/** Montant arrondi à l'euro, pour une estimation (« environ 87 € »). */
export function formatEurosRounded(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(cents / 100));
}
