import { TOUTES_COMMUNES } from "@/lib/territoires";
import { normaliserCommune, type GeocodagePort } from "./port";

/**
 * Adaptateur SIMULÉ (tests, e2e, développement sans réseau). Déterministe :
 * - adresse contenant « introuvable » → null (repli centre de commune) ;
 * - adresse contenant « rue » sans numéro → approximatif ;
 * - sinon : point exact, à quelques centaines de mètres du centre de la commune (selon le texte).
 */
export function creerGeocodageSimule(): GeocodagePort {
  return {
    nom: "simule",
    async geocoder({ adresse, commune }) {
      if (/introuvable/i.test(adresse)) return null;
      const c = TOUTES_COMMUNES.find((x) => normaliserCommune(x.label) === normaliserCommune(commune) || x.code === commune);
      if (!c) return null;
      let h = 0;
      for (const ch of adresse) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const dLat = ((h % 1000) - 500) / 200_000;
      const dLng = (((h >>> 10) % 1000) - 500) / 200_000;
      const numero = /^\s*\d+/.test(adresse);
      return { latitude: c.lat + dLat, longitude: c.lng + dLng, approximatif: !numero, libelle: `${adresse.trim()}, ${c.label} (simulé)` };
    },
  };
}
