/**
 * L2 (lot I4) : adaptateurs `CompanyRegistryPort`.
 * - `simule` : SIRET de test (actif, cessé, nom caché, nom différent, APE inattendu, inconnu). Fermé en lancement.
 * - `recherche-entreprises` : API ouverte, sans clé (recherche-entreprises.api.gouv.fr).
 * - `insee` : API Sirene (INSEE_API_KEY), source qui fait foi ; repli sur Recherche d'entreprises si elle ne répond pas.
 * Aucune donnée n'est envoyée sauf le SIRET.
 */
import { isLaunchMode } from "@/server/config-check";
import { ProviderUnavailableError, type CompanyLookup, type CompanyRegistryPort } from "@/server/ports/verification";
import { registryAdapterName } from "@/server/verifications/config";
import type { FetchLike } from "../otp";

type Env = Record<string, string | undefined>;
const TIMEOUT_MS = 8_000;

/** Indice donné au SEUL adaptateur simulé : il renvoie ce nom (le registre réel l'ignore). */
export type RegistryHint = { personName?: { givenNames: string; familyName: string }; address?: { line: string; postalCode: string; city: string } };

export interface HintedRegistryPort extends CompanyRegistryPort {
  lookupSiret(siret: string, hint?: RegistryHint): Promise<CompanyLookup>;
}

/** SIRET de test (clé de Luhn valide). Tout autre SIRET valide : entreprise active, nom conforme. */
export const SIMULATED_SIRETS = {
  CESSE: "91000000100008",
  NOM_CACHE: "91000000200006",
  NOM_DIFFERENT: "91000000300004",
  APE_INATTENDU: "91000000400002",
  INCONNU: "91000000500009",
  REGISTRE_MUET: "91000000600007",
} as const;

export class SimulatedRegistryAdapter implements HintedRegistryPort {
  readonly name = "simule" as const;
  constructor(private readonly env: Env = process.env) {}
  available(): boolean {
    return !isLaunchMode(this.env);
  }
  async lookupSiret(siret: string, hint: RegistryHint = {}): Promise<CompanyLookup> {
    const checkedAt = new Date();
    if (!this.available() || siret === SIMULATED_SIRETS.REGISTRE_MUET) throw new ProviderUnavailableError("simule", "registre muet");
    if (siret === SIMULATED_SIRETS.INCONNU) return { found: false, checkedAt, source: "simule" };
    const person = hint.personName ?? { givenNames: "JOSIANE", familyName: "EXEMPLE" };
    return {
      found: true,
      active: siret !== SIMULATED_SIRETS.CESSE,
      siren: siret.slice(0, 9),
      siret,
      legalForm: "1000",
      nafCode: siret === SIMULATED_SIRETS.APE_INATTENDU ? "62.01Z" : "88.10A",
      diffusion: siret === SIMULATED_SIRETS.NOM_CACHE ? "P" : "O",
      personName: siret === SIMULATED_SIRETS.NOM_CACHE ? undefined : siret === SIMULATED_SIRETS.NOM_DIFFERENT ? { givenNames: "AUTRE", familyName: "PERSONNE" } : person,
      seatAddress: hint.address,
      checkedAt,
      source: "simule",
    };
  }
}

// ─────────────── API Recherche d'entreprises (sans clé) ───────────────

export const RECHERCHE_ENTREPRISES_URL = "https://recherche-entreprises.api.gouv.fr/search";

type ReEtab = {
  siret?: string;
  etat_administratif?: string;
  adresse?: string;
  numero_voie?: string | null;
  indice_repetition?: string | null;
  type_voie?: string | null;
  libelle_voie?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
};
type ReResult = {
  siren?: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  etat_administratif?: string;
  activite_principale?: string | null;
  nature_juridique?: string | null;
  statut_diffusion?: string | null;
  siege?: ReEtab;
  matching_etablissements?: ReEtab[];
  complements?: { est_entrepreneur_individuel?: boolean } | null;
};

const ND = /NON[- ]DIFFUSIBLE|\[ND\]/i;

function streetLine(e: ReEtab): string | null {
  const parts = [e.numero_voie, e.indice_repetition, e.type_voie, e.libelle_voie].filter((p): p is string => Boolean(p && p.trim()));
  if (parts.length > 0) return parts.join(" ");
  if (!e.adresse) return null;
  // « 12 RUE DES FLAMBOYANTS 97232 LE LAMENTIN » → voie seule.
  return e.adresse.replace(/\s\d{5}\s.*$/, "").trim() || null;
}

/** Traduit la réponse de l'API Recherche d'entreprises (pur, testé avec des réponses enregistrées). */
export function parseRechercheEntreprises(siret: string, body: { results?: ReResult[] }, checkedAt: Date = new Date()): CompanyLookup {
  const r = (body.results ?? []).find((x) => x.siren === siret.slice(0, 9));
  if (!r) return { found: false, checkedAt, source: "recherche-entreprises" };
  const etab = [...(r.matching_etablissements ?? []), ...(r.siege ? [r.siege] : [])].find((e) => e.siret === siret);
  if (!etab) return { found: false, checkedAt, source: "recherche-entreprises" };
  const hidden = r.statut_diffusion === "P" || ND.test(r.nom_complet ?? "");
  const line = streetLine(etab);
  return {
    found: true,
    active: (etab.etat_administratif ?? r.etat_administratif) === "A" && r.etat_administratif !== "C",
    siren: siret.slice(0, 9),
    siret,
    legalForm: r.nature_juridique ?? null,
    nafCode: r.activite_principale ?? null,
    diffusion: hidden ? "P" : "O",
    fullName: hidden ? undefined : (r.nom_complet ?? r.nom_raison_sociale ?? undefined),
    seatAddress: line && etab.code_postal ? { line, postalCode: etab.code_postal, city: etab.libelle_commune ?? "" } : undefined,
    checkedAt,
    source: "recherche-entreprises",
  };
}

export class RechercheEntreprisesAdapter implements HintedRegistryPort {
  readonly name = "recherche-entreprises" as const;
  constructor(private readonly fetchImpl: FetchLike = fetch) {}
  available(): boolean {
    return true;
  }
  async lookupSiret(siret: string): Promise<CompanyLookup> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${RECHERCHE_ENTREPRISES_URL}?q=${encodeURIComponent(siret)}&page=1&per_page=5`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new ProviderUnavailableError("recherche-entreprises", e instanceof Error ? e.name : "réseau");
    }
    if (!res.ok) throw new ProviderUnavailableError("recherche-entreprises", `HTTP ${res.status}`);
    return parseRechercheEntreprises(siret, (await res.json().catch(() => ({}))) as { results?: ReResult[] });
  }
}

// ─────────────── API Sirene (INSEE) ───────────────

export const INSEE_SIRET_URL = "https://api.insee.fr/api-sirene/3.11/siret";

type InseeEtab = {
  siren?: string;
  siret?: string;
  statutDiffusionEtablissement?: string;
  uniteLegale?: {
    etatAdministratifUniteLegale?: string;
    statutDiffusionUniteLegale?: string;
    categorieJuridiqueUniteLegale?: string;
    activitePrincipaleUniteLegale?: string;
    denominationUniteLegale?: string | null;
    nomUniteLegale?: string | null;
    nomUsageUniteLegale?: string | null;
    prenom1UniteLegale?: string | null;
    prenomUsuelUniteLegale?: string | null;
  };
  adresseEtablissement?: {
    numeroVoieEtablissement?: string | null;
    indiceRepetitionEtablissement?: string | null;
    typeVoieEtablissement?: string | null;
    libelleVoieEtablissement?: string | null;
    codePostalEtablissement?: string | null;
    libelleCommuneEtablissement?: string | null;
  };
  periodesEtablissement?: { dateFin?: string | null; etatAdministratifEtablissement?: string }[];
};

/** Abréviations de voie de Sirene (RUE, AV, BD…) : gardées telles quelles, la comparaison les normalise. */
export function parseInsee(siret: string, body: { etablissement?: InseeEtab }, checkedAt: Date = new Date()): CompanyLookup {
  const e = body.etablissement;
  if (!e || e.siret !== siret) return { found: false, checkedAt, source: "insee" };
  const ul = e.uniteLegale ?? {};
  const current = (e.periodesEtablissement ?? []).find((p) => !p.dateFin) ?? e.periodesEtablissement?.[0];
  const hidden = e.statutDiffusionEtablissement === "P" || ul.statutDiffusionUniteLegale === "P" || ND.test(ul.nomUniteLegale ?? "");
  const a = e.adresseEtablissement ?? {};
  const line = [a.numeroVoieEtablissement, a.indiceRepetitionEtablissement, a.typeVoieEtablissement, a.libelleVoieEtablissement].filter((x): x is string => Boolean(x && x.trim())).join(" ");
  const family = ul.nomUsageUniteLegale || ul.nomUniteLegale;
  const given = ul.prenomUsuelUniteLegale || ul.prenom1UniteLegale;
  return {
    found: true,
    active: ul.etatAdministratifUniteLegale === "A" && (current?.etatAdministratifEtablissement ?? "A") === "A",
    siren: siret.slice(0, 9),
    siret,
    legalForm: ul.categorieJuridiqueUniteLegale ?? null,
    nafCode: ul.activitePrincipaleUniteLegale ?? null,
    diffusion: hidden ? "P" : "O",
    personName: !hidden && family && given ? { givenNames: given, familyName: family } : undefined,
    fullName: !hidden && !family ? (ul.denominationUniteLegale ?? undefined) : undefined,
    seatAddress: line && a.codePostalEtablissement ? { line, postalCode: a.codePostalEtablissement, city: a.libelleCommuneEtablissement ?? "" } : undefined,
    checkedAt,
    source: "insee",
  };
}

export class InseeSireneAdapter implements HintedRegistryPort {
  readonly name = "insee" as const;
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}
  available(): boolean {
    return Boolean(this.apiKey?.trim());
  }
  async lookupSiret(siret: string): Promise<CompanyLookup> {
    if (!this.available()) throw new ProviderUnavailableError("insee", "clé absente");
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${INSEE_SIRET_URL}/${encodeURIComponent(siret)}`, {
        method: "GET",
        // [À VÉRIFIER] nom de l'en-tête du nouveau portail (portail-api.insee.fr, 2024).
        headers: { "X-INSEE-Api-Key-Integration": this.apiKey!, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new ProviderUnavailableError("insee", e instanceof Error ? e.name : "réseau");
    }
    if (res.status === 404) return { found: false, checkedAt: new Date(), source: "insee" };
    if (!res.ok) throw new ProviderUnavailableError("insee", `HTTP ${res.status}`);
    return parseInsee(siret, (await res.json().catch(() => ({}))) as { etablissement?: InseeEtab });
  }
}

/** INSEE d'abord (source qui fait foi), puis Recherche d'entreprises si l'INSEE ne répond pas ou n'a pas de clé. */
export class InseeWithFallbackAdapter implements HintedRegistryPort {
  readonly name = "insee+recherche-entreprises" as const;
  constructor(
    private readonly insee: InseeSireneAdapter,
    private readonly fallback: RechercheEntreprisesAdapter,
  ) {}
  available(): boolean {
    return true;
  }
  async lookupSiret(siret: string): Promise<CompanyLookup> {
    if (this.insee.available()) {
      try {
        return await this.insee.lookupSiret(siret);
      } catch (e) {
        if (!(e instanceof ProviderUnavailableError)) throw e;
      }
    }
    return this.fallback.lookupSiret(siret);
  }
}

let override: HintedRegistryPort | null = null;
export function setRegistryPortForTests(port: HintedRegistryPort | null): void {
  override = port;
}

export function registryPort(env: Env = process.env): HintedRegistryPort {
  if (override) return override;
  switch (registryAdapterName(env)) {
    case "recherche-entreprises":
      return new RechercheEntreprisesAdapter();
    case "insee":
      return new InseeWithFallbackAdapter(new InseeSireneAdapter(env.INSEE_API_KEY), new RechercheEntreprisesAdapter());
    default:
      return new SimulatedRegistryAdapter(env);
  }
}
