import { normaliserCommune, type DemandeGeocodage, type GeocodagePort, type ResultatGeocodage } from "./port";

/**
 * Adaptateur API Adresse (Base Adresse Nationale), `GET https://api-adresse.data.gouv.fr/search/`.
 * Sans clé. [À VÉRIFIER] Migration annoncée vers `data.geopf.fr/geocodage` (IGN) : l'URL est paramétrable.
 * Règles :
 * - un seul résultat demandé, code postal de Martinique (972xx) et commune identique, sinon null ;
 * - score < 0,5 → null (repli : centre de la commune) ;
 * - type `housenumber` = point exact ; `street`, `locality`… = approximatif ;
 * - délai 3 s ; une erreur réseau donne null (jamais d'exception).
 * L'adresse n'est jamais écrite dans le journal du serveur.
 */
export const SCORE_MIN = 0.5;

type Feature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { score?: number; type?: string; city?: string; postcode?: string; label?: string };
};

export function lireReponse(json: unknown, demande: DemandeGeocodage): ResultatGeocodage | null {
  const f = (json as { features?: Feature[] } | null)?.features?.[0];
  const coords = f?.geometry?.coordinates;
  const p = f?.properties;
  if (!coords || !p || typeof p.score !== "number" || p.score < SCORE_MIN) return null;
  if (!p.postcode?.startsWith("972")) return null;
  if (!p.city || normaliserCommune(p.city) !== normaliserCommune(demande.commune)) return null;
  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, approximatif: p.type !== "housenumber", libelle: p.label ?? demande.adresse };
}

export function creerGeocodageApiAdresse(
  opts: { url?: string; fetchFn?: typeof fetch; delaiMs?: number } = {},
): GeocodagePort {
  const url = opts.url ?? "https://api-adresse.data.gouv.fr/search/";
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    nom: "api-adresse",
    async geocoder(demande) {
      const q = `${demande.adresse}, ${demande.commune}`.slice(0, 200);
      const params = new URLSearchParams({ q, limit: "1" });
      try {
        const res = await fetchFn(`${url}?${params}`, { signal: AbortSignal.timeout(opts.delaiMs ?? 3000), headers: { accept: "application/json" } });
        if (!res.ok) {
          console.warn(`[geocodage:api-adresse] réponse ${res.status}`);
          return null;
        }
        return lireReponse(await res.json(), demande);
      } catch (e) {
        console.warn(`[geocodage:api-adresse] erreur ${e instanceof Error ? e.name : "inconnue"}`);
        return null;
      }
    },
  };
}
