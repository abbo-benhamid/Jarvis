import { describe, expect, it, vi } from "vitest";
import { creerGeocodageApiAdresse, lireReponse } from "./api-adresse";
import { creerGeocodageSimule } from "./simule";
import { geocodagePort, nomAdaptateurGeocodage, normaliserCommune, type GeocodagePort } from "./index";

/** Réponse type de l'API Adresse (extrait). */
function reponse(over: Record<string, unknown> = {}, coords: [number, number] = [-60.9996, 14.6131]) {
  return {
    features: [
      {
        geometry: { type: "Point", coordinates: coords },
        properties: { score: 0.82, type: "housenumber", city: "Le Lamentin", postcode: "97232", label: "12 Rue Schoelcher 97232 Le Lamentin", ...over },
      },
    ],
  };
}

function fauxFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
}

/** Contrat commun : chaque adaptateur répond un résultat ou null, et ne lève jamais. */
function contrat(nom: string, port: () => GeocodagePort, attendu: "trouve" | "null") {
  it(`${nom} : respecte le contrat du port`, async () => {
    const r = await port().geocoder({ adresse: "12 rue Schoelcher", commune: "Le Lamentin" });
    if (attendu === "null") expect(r).toBeNull();
    else {
      expect(r).not.toBeNull();
      expect(typeof r!.latitude).toBe("number");
      expect(typeof r!.longitude).toBe("number");
      expect(typeof r!.approximatif).toBe("boolean");
      expect(r!.libelle.length).toBeGreaterThan(0);
    }
  });
}

describe("géocodage (L8) — tests contractuels des adaptateurs", () => {
  contrat("simule", creerGeocodageSimule, "trouve");
  contrat("api-adresse (réponse correcte)", () => creerGeocodageApiAdresse({ fetchFn: fauxFetch(reponse()) }), "trouve");
  contrat("api-adresse (erreur 500)", () => creerGeocodageApiAdresse({ fetchFn: fauxFetch({}, 500) }), "null");
  contrat(
    "api-adresse (réseau coupé)",
    () => creerGeocodageApiAdresse({ fetchFn: vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch }),
    "null",
  );
});

describe("api-adresse : lecture de la réponse", () => {
  const demande = { adresse: "12 rue Schoelcher", commune: "Le Lamentin" };
  it("numéro trouvé → point exact ; rue seule → approximatif", () => {
    expect(lireReponse(reponse(), demande)).toMatchObject({ latitude: 14.6131, longitude: -60.9996, approximatif: false });
    expect(lireReponse(reponse({ type: "street" }), demande)?.approximatif).toBe(true);
  });
  it("score trop bas, hors Martinique, autre commune, réponse vide → null (repli centre de commune)", () => {
    expect(lireReponse(reponse({ score: 0.3 }), demande)).toBeNull();
    expect(lireReponse(reponse({ postcode: "75001" }), demande)).toBeNull();
    expect(lireReponse(reponse({ city: "Le Robert" }), demande)).toBeNull();
    expect(lireReponse({ features: [] }, demande)).toBeNull();
    expect(lireReponse(null, demande)).toBeNull();
  });
  it("envoie l'adresse et la commune, un seul résultat", async () => {
    const f = fauxFetch(reponse());
    await creerGeocodageApiAdresse({ fetchFn: f }).geocoder(demande);
    const url = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(url).toContain("api-adresse.data.gouv.fr/search/");
    expect(url).toContain("limit=1");
    expect(decodeURIComponent(url.replace(/\+/g, " "))).toContain("12 rue Schoelcher, Le Lamentin");
  });
});

describe("choix de l'adaptateur", () => {
  it("simule sous Vitest ou si demandé ; api-adresse sinon", () => {
    expect(nomAdaptateurGeocodage({ VITEST: "true" })).toBe("simule");
    expect(nomAdaptateurGeocodage({})).toBe("api-adresse");
    expect(nomAdaptateurGeocodage({ ADAPTER_GEOCODAGE: "simule" })).toBe("simule");
    expect(geocodagePort({ ADAPTER_GEOCODAGE: "api-adresse" }).nom).toBe("api-adresse");
  });
  it("normalise les noms de commune", () => {
    expect(normaliserCommune("Le Lamentin")).toBe(normaliserCommune("LAMENTIN"));
    expect(normaliserCommune("Les Anses-d'Arlet")).toBe("ANSESDARLET");
  });
  it("simule : « introuvable » → null ; sans numéro → approximatif", async () => {
    const p = creerGeocodageSimule();
    expect(await p.geocoder({ adresse: "adresse introuvable", commune: "Le Lamentin" })).toBeNull();
    expect((await p.geocoder({ adresse: "rue Schoelcher", commune: "Le Lamentin" }))?.approximatif).toBe(true);
  });
});
