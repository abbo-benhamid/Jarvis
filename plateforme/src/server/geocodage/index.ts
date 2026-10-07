import { creerGeocodageApiAdresse } from "./api-adresse";
import { creerGeocodageSimule } from "./simule";
import type { GeocodagePort } from "./port";

/**
 * Choix de l'adaptateur de géocodage (lot L1-B, L8).
 * - `ADAPTER_GEOCODAGE=simule` : sans réseau. Aussi par défaut sous Vitest (`VITEST` posé).
 * - sinon `api-adresse` (API Adresse de l'État, sans clé).
 */
export type { DemandeGeocodage, GeocodagePort, ResultatGeocodage } from "./port";
export { normaliserCommune } from "./port";

let surcharge: GeocodagePort | null = null;

/** Tests seulement : remplace l'adaptateur (null = retour au choix par l'environnement). */
export function definirGeocodagePourTests(port: GeocodagePort | null): void {
  surcharge = port;
}

export function nomAdaptateurGeocodage(env: Record<string, string | undefined> = process.env): "api-adresse" | "simule" {
  const v = env.ADAPTER_GEOCODAGE?.trim().toLowerCase();
  if (v === "simule") return "simule";
  if (v === "api-adresse") return "api-adresse";
  return env.VITEST ? "simule" : "api-adresse";
}

export function geocodagePort(env: Record<string, string | undefined> = process.env): GeocodagePort {
  if (surcharge) return surcharge;
  return nomAdaptateurGeocodage(env) === "simule" ? creerGeocodageSimule() : creerGeocodageApiAdresse({ url: env.GEOCODAGE_URL?.trim() || undefined });
}
