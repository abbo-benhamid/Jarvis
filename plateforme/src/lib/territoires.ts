/**
 * T1 : configuration UNIQUE des territoires (arbitrage `docs/revues/T1-arbitrage-guadeloupe.md`).
 * Le territoire est une DONNÉE : nom, fuseau IANA, indicatifs, communes avec leur centre, état, organismes locaux.
 * Utilisable client et serveur (aucune dépendance serveur).
 *
 * Au lancement, seule la Guadeloupe est OUVERTE. Les autres territoires affichent « Bientôt » et une liste d'attente.
 *
 * Codes de commune : UNIQUES sur tous les territoires (un code suffit pour retrouver la commune et son territoire).
 * Les codes de Martinique ne changent pas (lignes existantes). Deux communes de Guadeloupe portent le même nom
 * qu'une commune de Martinique : elles ont le suffixe « _GP » (LAMENTIN_GP, SAINTE_ANNE_GP).
 *
 * [À VÉRIFIER] Centres des communes : coordonnées approximatives (± 1 km), suffisantes pour le centre par défaut
 * d'un domicile. Codes postaux de Guadeloupe à vérifier avec la base officielle des codes postaux (La Poste).
 */
import { TERRITOIRES, type CodeTerritoire, type EtatTerritoire, type TerritoireInfo } from "@/contracts/v1/territoires";

export { TERRITOIRES };
export type { CodeTerritoire, EtatTerritoire };

export type Commune = {
  code: string;
  label: string;
  lat: number;
  lng: number;
  territoire: CodeTerritoire;
  /** Regroupement pour l'affichage (ex. « Grande-Terre »). */
  zone: string;
  /** Code postal principal (Guadeloupe). Filtre `postcode` du géocodage. */
  codePostal?: string;
};

export type Organismes = {
  /** Déclaration SAP (services à la personne). */
  sap: string;
  /** Sécurité sociale (CESU, cotisations). */
  securiteSociale: string;
  /** Agence régionale de santé. */
  sante: string;
  /** Allocation personnalisée d'autonomie (APA). */
  apa: string;
};

export type Territoire = {
  code: CodeTerritoire;
  nom: string;
  /** « en Guadeloupe », « en Guyane », « dans l'Hexagone ». */
  enNom: string;
  /** « de Guadeloupe », « de Guyane », « de l'Hexagone ». */
  deNom: string;
  /** « heure de Guadeloupe », « heure de Paris ». */
  libelleHeure: string;
  etat: EtatTerritoire;
  /** Fuseau IANA : toute heure locale se calcule avec lui (jamais un décalage en dur). */
  fuseau: string;
  /** Indicatif téléphonique (ex. « +590 »). */
  indicatif: string;
  /** Préfixes E.164 des mobiles (T5). */
  prefixesMobiles: readonly string[];
  /** Préfixes E.164 des lignes fixes (appel vocal seulement). */
  prefixesFixes: readonly string[];
  /** Exemple de numéro affiché dans les formulaires. */
  exempleTelephone: string;
  /** Centre de la carte (MapLibre). */
  centre: { lat: number; lng: number; zoom: number };
  /** Emprise de la carte [ouest, sud, est, nord]. */
  emprise: [number, number, number, number];
  /** Liste fermée des communes. Vide = saisie libre avec code postal. */
  communes: readonly Commune[];
  /** Préfixes des codes postaux du territoire (contrôle de la saisie libre). */
  prefixesCodePostal: readonly string[];
  organismes: Organismes;
};

// ─────────────── Guadeloupe : 32 communes (sans Saint-Martin ni Saint-Barthélemy) ───────────────

const GP_BT = "Basse-Terre";
const GP_GT = "Grande-Terre";
const GP_IL = "Îles du Sud";

const gp = (code: string, label: string, lat: number, lng: number, zone: string, codePostal: string): Commune => ({
  code,
  label,
  lat,
  lng,
  zone,
  codePostal,
  territoire: "GUADELOUPE",
});

export const COMMUNES_GUADELOUPE: readonly Commune[] = [
  gp("ABYMES", "Les Abymes", 16.271, -61.5045, GP_GT, "97139"),
  gp("ANSE_BERTRAND", "Anse-Bertrand", 16.4728, -61.5078, GP_GT, "97121"),
  gp("BAIE_MAHAULT", "Baie-Mahault", 16.2675, -61.5853, GP_BT, "97122"),
  gp("BAILLIF", "Baillif", 16.0203, -61.7461, GP_BT, "97123"),
  gp("BASSE_TERRE", "Basse-Terre", 15.9958, -61.7292, GP_BT, "97100"),
  gp("BOUILLANTE", "Bouillante", 16.1306, -61.7686, GP_BT, "97125"),
  gp("CAPESTERRE_BELLE_EAU", "Capesterre-Belle-Eau", 16.0436, -61.5653, GP_BT, "97130"),
  gp("CAPESTERRE_DE_MARIE_GALANTE", "Capesterre-de-Marie-Galante", 15.8975, -61.2264, GP_IL, "97140"),
  gp("DESIRADE", "La Désirade", 16.3125, -61.0703, GP_IL, "97127"),
  gp("DESHAIES", "Deshaies", 16.3058, -61.7944, GP_BT, "97126"),
  gp("GOURBEYRE", "Gourbeyre", 15.9939, -61.6969, GP_BT, "97113"),
  gp("GOYAVE", "Goyave", 16.135, -61.5711, GP_BT, "97128"),
  gp("GOSIER", "Le Gosier", 16.2069, -61.4931, GP_GT, "97190"),
  gp("GRAND_BOURG", "Grand-Bourg", 15.8833, -61.3139, GP_IL, "97112"),
  gp("LAMENTIN_GP", "Lamentin", 16.2689, -61.6325, GP_BT, "97129"),
  gp("MORNE_A_L_EAU", "Morne-à-l'Eau", 16.3328, -61.4556, GP_GT, "97111"),
  gp("MOULE", "Le Moule", 16.3333, -61.3444, GP_GT, "97160"),
  gp("PETIT_BOURG", "Petit-Bourg", 16.1914, -61.5914, GP_BT, "97170"),
  gp("PETIT_CANAL", "Petit-Canal", 16.3792, -61.4864, GP_GT, "97131"),
  gp("POINTE_A_PITRE", "Pointe-à-Pitre", 16.2411, -61.5331, GP_GT, "97110"),
  gp("POINTE_NOIRE", "Pointe-Noire", 16.2322, -61.7867, GP_BT, "97116"),
  gp("PORT_LOUIS", "Port-Louis", 16.4189, -61.5306, GP_GT, "97117"),
  gp("SAINT_CLAUDE", "Saint-Claude", 16.0258, -61.7019, GP_BT, "97120"),
  gp("SAINT_FRANCOIS", "Saint-François", 16.2525, -61.2742, GP_GT, "97118"),
  gp("SAINT_LOUIS", "Saint-Louis", 15.9561, -61.315, GP_IL, "97134"),
  gp("SAINTE_ANNE_GP", "Sainte-Anne", 16.2264, -61.3797, GP_GT, "97180"),
  gp("SAINTE_ROSE", "Sainte-Rose", 16.3328, -61.6978, GP_BT, "97115"),
  gp("TERRE_DE_BAS", "Terre-de-Bas", 15.8519, -61.6353, GP_IL, "97136"),
  gp("TERRE_DE_HAUT", "Terre-de-Haut", 15.8661, -61.5847, GP_IL, "97137"),
  gp("TROIS_RIVIERES", "Trois-Rivières", 15.9758, -61.6453, GP_BT, "97114"),
  gp("VIEUX_FORT", "Vieux-Fort", 15.9519, -61.7075, GP_BT, "97141"),
  gp("VIEUX_HABITANTS", "Vieux-Habitants", 16.0592, -61.7653, GP_BT, "97119"),
];

// ─────────────── Martinique : 34 communes (codes inchangés depuis le MVP) ───────────────

const MQ_CENTRE = "Centre";
const MQ_NA = "Nord Atlantique";
const MQ_NC = "Nord Caraïbe";
const MQ_SUD = "Sud";

const mq = (code: string, label: string, lat: number, lng: number, zone: string): Commune => ({ code, label, lat, lng, zone, territoire: "MARTINIQUE" });

export const COMMUNES_MARTINIQUE: readonly Commune[] = [
  mq("AJOUPA_BOUILLON", "L'Ajoupa-Bouillon", 14.8167, -61.1417, MQ_NC),
  mq("ANSES_D_ARLET", "Les Anses-d'Arlet", 14.4886, -61.0814, MQ_SUD),
  mq("BASSE_POINTE", "Basse-Pointe", 14.8717, -61.115, MQ_NC),
  mq("BELLEFONTAINE", "Bellefontaine", 14.6683, -61.1597, MQ_NC),
  mq("CARBET", "Le Carbet", 14.7067, -61.1772, MQ_NC),
  mq("CASE_PILOTE", "Case-Pilote", 14.6417, -61.1361, MQ_NC),
  mq("DIAMANT", "Le Diamant", 14.4778, -61.0281, MQ_SUD),
  mq("DUCOS", "Ducos", 14.5747, -60.9747, MQ_SUD),
  mq("FONDS_SAINT_DENIS", "Fonds-Saint-Denis", 14.7333, -61.1167, MQ_NC),
  mq("FORT_DE_FRANCE", "Fort-de-France", 14.6161, -61.0588, MQ_CENTRE),
  mq("FRANCOIS", "Le François", 14.6158, -60.9036, MQ_SUD),
  mq("GRAND_RIVIERE", "Grand'Rivière", 14.8714, -61.1797, MQ_NC),
  mq("GROS_MORNE", "Le Gros-Morne", 14.71, -61.0119, MQ_NA),
  mq("LAMENTIN", "Le Lamentin", 14.6131, -60.9996, MQ_CENTRE),
  mq("LORRAIN", "Le Lorrain", 14.8297, -61.0603, MQ_NA),
  mq("MACOUBA", "Macouba", 14.875, -61.1417, MQ_NC),
  mq("MARIGOT", "Le Marigot", 14.8167, -61.0333, MQ_NA),
  mq("MARIN", "Le Marin", 14.4686, -60.8697, MQ_SUD),
  mq("MORNE_ROUGE", "Le Morne-Rouge", 14.7681, -61.1333, MQ_NC),
  mq("MORNE_VERT", "Le Morne-Vert", 14.705, -61.135, MQ_NC),
  mq("PRECHEUR", "Le Prêcheur", 14.8, -61.225, MQ_NC),
  mq("RIVIERE_PILOTE", "Rivière-Pilote", 14.4836, -60.9011, MQ_SUD),
  mq("RIVIERE_SALEE", "Rivière-Salée", 14.5333, -60.9667, MQ_SUD),
  mq("ROBERT", "Le Robert", 14.6772, -60.9394, MQ_NA),
  mq("SAINT_ESPRIT", "Saint-Esprit", 14.5583, -60.9278, MQ_SUD),
  mq("SAINT_JOSEPH", "Saint-Joseph", 14.6711, -61.0397, MQ_CENTRE),
  mq("SAINT_PIERRE", "Saint-Pierre", 14.7431, -61.1758, MQ_NC),
  mq("SAINTE_ANNE", "Sainte-Anne", 14.4381, -60.8817, MQ_SUD),
  mq("SAINTE_LUCE", "Sainte-Luce", 14.4697, -60.9244, MQ_SUD),
  mq("SAINTE_MARIE", "Sainte-Marie", 14.7836, -60.9914, MQ_NA),
  mq("SCHOELCHER", "Schœlcher", 14.6145, -61.0905, MQ_CENTRE),
  mq("TRINITE", "La Trinité", 14.7381, -60.9625, MQ_NA),
  mq("TROIS_ILETS", "Les Trois-Îlets", 14.5389, -61.0397, MQ_SUD),
  mq("VAUCLIN", "Le Vauclin", 14.545, -60.8381, MQ_SUD),
];

// ─────────────── Configuration ───────────────

export const TERRITOIRES_CONFIG: Readonly<Record<CodeTerritoire, Territoire>> = {
  GUADELOUPE: {
    code: "GUADELOUPE",
    nom: "Guadeloupe",
    enNom: "en Guadeloupe",
    deNom: "de Guadeloupe",
    libelleHeure: "heure de Guadeloupe",
    etat: "OUVERT",
    fuseau: "America/Guadeloupe",
    indicatif: "+590",
    prefixesMobiles: ["+590690", "+590691"],
    prefixesFixes: ["+590590"],
    exempleTelephone: "0690 12 34 56",
    centre: { lat: 16.2, lng: -61.55, zoom: 9 },
    emprise: [-61.9, 15.8, -60.95, 16.55],
    communes: COMMUNES_GUADELOUPE,
    prefixesCodePostal: ["971"],
    organismes: {
      sap: "DEETS de Guadeloupe",
      securiteSociale: "CGSS de Guadeloupe",
      sante: "ARS de Guadeloupe",
      apa: "Département de la Guadeloupe",
    },
  },
  MARTINIQUE: {
    code: "MARTINIQUE",
    nom: "Martinique",
    enNom: "en Martinique",
    deNom: "de Martinique",
    libelleHeure: "heure de Martinique",
    etat: "BIENTOT",
    fuseau: "America/Martinique",
    indicatif: "+596",
    prefixesMobiles: ["+596696", "+596697"],
    prefixesFixes: ["+596596"],
    exempleTelephone: "0696 12 34 56",
    centre: { lat: 14.64, lng: -61.02, zoom: 10 },
    emprise: [-61.3, 14.35, -60.75, 14.92],
    communes: COMMUNES_MARTINIQUE,
    prefixesCodePostal: ["972"],
    organismes: {
      sap: "DEETS de Martinique",
      securiteSociale: "CGSS de Martinique",
      sante: "ARS de Martinique",
      apa: "Collectivité territoriale de Martinique",
    },
  },
  GUYANE: {
    code: "GUYANE",
    nom: "Guyane",
    enNom: "en Guyane",
    deNom: "de Guyane",
    libelleHeure: "heure de Guyane",
    etat: "BIENTOT",
    fuseau: "America/Cayenne",
    indicatif: "+594",
    // [À VÉRIFIER] +594695 (nouvelle tranche mobile) : hors T5, pas encore acceptée.
    prefixesMobiles: ["+594694"],
    prefixesFixes: ["+594594"],
    exempleTelephone: "0694 12 34 56",
    centre: { lat: 4.4, lng: -53.0, zoom: 6 },
    emprise: [-54.7, 2.1, -51.5, 5.9],
    communes: [],
    prefixesCodePostal: ["973"],
    organismes: {
      // [À VÉRIFIER] En Guyane, la DEETS est intégrée à la DGCOPOP.
      sap: "DGCOPOP de Guyane",
      securiteSociale: "CGSS de Guyane",
      sante: "ARS de Guyane",
      apa: "Collectivité territoriale de Guyane",
    },
  },
  HEXAGONE: {
    code: "HEXAGONE",
    nom: "Hexagone",
    enNom: "dans l'Hexagone",
    deNom: "de l'Hexagone",
    libelleHeure: "heure de Paris",
    etat: "BIENTOT",
    fuseau: "Europe/Paris",
    indicatif: "+33",
    prefixesMobiles: ["+336", "+337"],
    prefixesFixes: ["+331", "+332", "+333", "+334", "+335", "+339"],
    exempleTelephone: "06 12 34 56 78",
    centre: { lat: 46.6, lng: 2.4, zoom: 5 },
    emprise: [-5.2, 41.3, 9.6, 51.2],
    communes: [],
    // Tout code postal à 5 chiffres sauf l'outre-mer (97…, 98…).
    prefixesCodePostal: [],
    organismes: {
      sap: "DDETS du département",
      securiteSociale: "Urssaf et CPAM",
      sante: "ARS de la région",
      apa: "Conseil départemental",
    },
  },
};

/** Territoire de lancement (T2) : seul territoire ouvert au départ, territoire par défaut des écrans. */
export const TERRITOIRE_LANCEMENT: CodeTerritoire = "GUADELOUPE";

export function territoire(code: CodeTerritoire): Territoire {
  return TERRITOIRES_CONFIG[code];
}

export function isTerritoire(v: unknown): v is CodeTerritoire {
  return typeof v === "string" && (TERRITOIRES as readonly string[]).includes(v);
}

export function isOuvert(code: CodeTerritoire): boolean {
  return TERRITOIRES_CONFIG[code].etat === "OUVERT";
}

export const TERRITOIRES_OUVERTS: readonly CodeTerritoire[] = TERRITOIRES.filter(isOuvert);
export const TERRITOIRES_BIENTOT: readonly CodeTerritoire[] = TERRITOIRES.filter((t) => !isOuvert(t));

/** « Guadeloupe » ; « Guadeloupe et Martinique » ; « Guadeloupe, Martinique et Guyane ». */
export function listeNoms(codes: readonly CodeTerritoire[]): string {
  const noms = codes.map((c) => TERRITOIRES_CONFIG[c].nom);
  return noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Fuseau IANA d'un territoire (repli : territoire de lancement). */
export function fuseauDe(code: CodeTerritoire | null | undefined): string {
  return TERRITOIRES_CONFIG[code ?? TERRITOIRE_LANCEMENT].fuseau;
}

// ─────────────── Communes ───────────────

/** Toutes les communes connues, tous territoires. */
export const TOUTES_COMMUNES: readonly Commune[] = TERRITOIRES.flatMap((t) => TERRITOIRES_CONFIG[t].communes);

const PAR_CODE = new Map(TOUTES_COMMUNES.map((c) => [c.code, c]));

export function communesDe(code: CodeTerritoire): readonly Commune[] {
  return TERRITOIRES_CONFIG[code].communes;
}

/** Codes des communes d'un territoire (pour `z.enum`). Vide si le territoire n'a pas de liste. */
export function codesCommunesDe(code: CodeTerritoire): string[] {
  return TERRITOIRES_CONFIG[code].communes.map((c) => c.code);
}

/** Codes des communes des territoires OUVERTS (création d'aîné, zone d'intervention). */
export const CODES_COMMUNES_OUVERTES = TERRITOIRES_OUVERTS.flatMap(codesCommunesDe) as [string, ...string[]];

export function getCommune(code: string): Commune | undefined {
  return PAR_CODE.get(code);
}

export function communeLabel(code: string): string {
  return PAR_CODE.get(code)?.label ?? code;
}

/** Territoire d'un code de commune connu ; undefined sinon. */
export function territoireDeCommune(code: string): CodeTerritoire | undefined {
  return PAR_CODE.get(code)?.territoire;
}

/** La commune existe ET appartient au territoire. */
export function communeDansTerritoire(code: string, t: CodeTerritoire): boolean {
  return PAR_CODE.get(code)?.territoire === t;
}

/** Regroupement des communes d'un territoire pour l'affichage (ordre de première apparition des zones). */
export function zonesDe(code: CodeTerritoire): { label: string; codes: string[] }[] {
  const out: { label: string; codes: string[] }[] = [];
  for (const c of [...communesDe(code)].sort((a, b) => a.label.localeCompare(b.label, "fr"))) {
    let z = out.find((x) => x.label === c.zone);
    if (!z) out.push((z = { label: c.zone, codes: [] }));
    z.codes.push(c.code);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

/** Code postal plausible pour le territoire (saisie libre : Guyane, Hexagone). */
export function codePostalDansTerritoire(cp: string, t: CodeTerritoire): boolean {
  if (!/^\d{5}$/.test(cp)) return false;
  if (t === "HEXAGONE") return !cp.startsWith("97") && !cp.startsWith("98");
  return TERRITOIRES_CONFIG[t].prefixesCodePostal.some((p) => cp.startsWith(p));
}

/** Vue publique (contrat GET /api/v1/territoires). Sans les organismes. */
export function territoirePublic(code: CodeTerritoire): TerritoireInfo {
  const t = TERRITOIRES_CONFIG[code];
  return {
    code: t.code,
    nom: t.nom,
    libelleHeure: t.libelleHeure,
    etat: t.etat,
    fuseau: t.fuseau,
    indicatif: t.indicatif,
    prefixesMobiles: [...t.prefixesMobiles],
    centre: { ...t.centre },
    communes: t.communes.map((c) => ({ code: c.code, libelle: c.label, zone: c.zone, lat: c.lat, lng: c.lng })),
  };
}
