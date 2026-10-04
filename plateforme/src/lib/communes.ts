/**
 * Les 34 communes de Martinique, avec un centre approximatif.
 * Le centre sert de position par défaut du domicile (facteur GPS).
 * [À VÉRIFIER] Coordonnées approximatives (± 1 km) : suffisantes pour un MVP avec données fictives.
 */
export type Commune = {
  code: string;
  label: string;
  lat: number;
  lng: number;
};

export const COMMUNES: readonly Commune[] = [
  { code: "AJOUPA_BOUILLON", label: "L'Ajoupa-Bouillon", lat: 14.8167, lng: -61.1417 },
  { code: "ANSES_D_ARLET", label: "Les Anses-d'Arlet", lat: 14.4886, lng: -61.0814 },
  { code: "BASSE_POINTE", label: "Basse-Pointe", lat: 14.8717, lng: -61.115 },
  { code: "BELLEFONTAINE", label: "Bellefontaine", lat: 14.6683, lng: -61.1597 },
  { code: "CARBET", label: "Le Carbet", lat: 14.7067, lng: -61.1772 },
  { code: "CASE_PILOTE", label: "Case-Pilote", lat: 14.6417, lng: -61.1361 },
  { code: "DIAMANT", label: "Le Diamant", lat: 14.4778, lng: -61.0281 },
  { code: "DUCOS", label: "Ducos", lat: 14.5747, lng: -60.9747 },
  { code: "FONDS_SAINT_DENIS", label: "Fonds-Saint-Denis", lat: 14.7333, lng: -61.1167 },
  { code: "FORT_DE_FRANCE", label: "Fort-de-France", lat: 14.6161, lng: -61.0588 },
  { code: "FRANCOIS", label: "Le François", lat: 14.6158, lng: -60.9036 },
  { code: "GRAND_RIVIERE", label: "Grand'Rivière", lat: 14.8714, lng: -61.1797 },
  { code: "GROS_MORNE", label: "Le Gros-Morne", lat: 14.71, lng: -61.0119 },
  { code: "LAMENTIN", label: "Le Lamentin", lat: 14.6131, lng: -60.9996 },
  { code: "LORRAIN", label: "Le Lorrain", lat: 14.8297, lng: -61.0603 },
  { code: "MACOUBA", label: "Macouba", lat: 14.875, lng: -61.1417 },
  { code: "MARIGOT", label: "Le Marigot", lat: 14.8167, lng: -61.0333 },
  { code: "MARIN", label: "Le Marin", lat: 14.4686, lng: -60.8697 },
  { code: "MORNE_ROUGE", label: "Le Morne-Rouge", lat: 14.7681, lng: -61.1333 },
  { code: "MORNE_VERT", label: "Le Morne-Vert", lat: 14.705, lng: -61.135 },
  { code: "PRECHEUR", label: "Le Prêcheur", lat: 14.8, lng: -61.225 },
  { code: "RIVIERE_PILOTE", label: "Rivière-Pilote", lat: 14.4836, lng: -60.9011 },
  { code: "RIVIERE_SALEE", label: "Rivière-Salée", lat: 14.5333, lng: -60.9667 },
  { code: "ROBERT", label: "Le Robert", lat: 14.6772, lng: -60.9394 },
  { code: "SAINT_ESPRIT", label: "Saint-Esprit", lat: 14.5583, lng: -60.9278 },
  { code: "SAINT_JOSEPH", label: "Saint-Joseph", lat: 14.6711, lng: -61.0397 },
  { code: "SAINT_PIERRE", label: "Saint-Pierre", lat: 14.7431, lng: -61.1758 },
  { code: "SAINTE_ANNE", label: "Sainte-Anne", lat: 14.4381, lng: -60.8817 },
  { code: "SAINTE_LUCE", label: "Sainte-Luce", lat: 14.4697, lng: -60.9244 },
  { code: "SAINTE_MARIE", label: "Sainte-Marie", lat: 14.7836, lng: -60.9914 },
  { code: "SCHOELCHER", label: "Schœlcher", lat: 14.6145, lng: -61.0905 },
  { code: "TRINITE", label: "La Trinité", lat: 14.7381, lng: -60.9625 },
  { code: "TROIS_ILETS", label: "Les Trois-Îlets", lat: 14.5389, lng: -61.0397 },
  { code: "VAUCLIN", label: "Le Vauclin", lat: 14.545, lng: -60.8381 },
] as const;

export const COMMUNE_CODES = COMMUNES.map((c) => c.code) as [string, ...string[]];

export function getCommune(code: string): Commune | undefined {
  return COMMUNES.find((c) => c.code === code);
}

export function communeLabel(code: string): string {
  return getCommune(code)?.label ?? code;
}

export function isCommuneCode(code: string): boolean {
  return COMMUNES.some((c) => c.code === code);
}
