/**
 * Port du géocodage de l'adresse de l'aîné (lot L1-B, décision L8).
 *
 * Le métier ne connaît QUE cette interface. Deux adaptateurs :
 * - `api-adresse` (défaut) : API Adresse de l'État (`api-adresse.data.gouv.fr`), sans clé, couvre la Martinique ;
 * - `simule` : réponse calculée, sans réseau (tests, e2e).
 * Choix par `ADAPTER_GEOCODAGE=api-adresse|simule`. Doc : docs/tech/integrations/geocodage.md
 *
 * Fichier pur (aucun import serveur).
 */

export type DemandeGeocodage = {
  /** Adresse saisie par la famille (numéro, rue, quartier). */
  adresse: string;
  /** Nom de la commune (ex. « Le Lamentin ») : ajouté à la requête et contrôlé dans la réponse. */
  commune: string;
};

export type ResultatGeocodage = {
  latitude: number;
  longitude: number;
  /** true si le point n'est pas le numéro exact (rue, lieu-dit, quartier). */
  approximatif: boolean;
  /** Libellé normalisé renvoyé par le service (affiché à la famille pour vérifier). */
  libelle: string;
};

export interface GeocodagePort {
  readonly nom: "api-adresse" | "simule";
  /** Null si l'adresse est introuvable, hors de la commune, ou si le service ne répond pas. Ne lève jamais. */
  geocoder(demande: DemandeGeocodage): Promise<ResultatGeocodage | null>;
}

/** Normalise un nom de commune pour la comparaison (« Le Lamentin » = « LAMENTIN » = « le-lamentin »). */
export function normaliserCommune(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/^(LE|LA|LES|L)[\s'’-]+/, "")
    .replace(/[^A-Z]/g, "");
}
