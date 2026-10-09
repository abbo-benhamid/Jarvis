/**
 * L2 : parcours de vérification dans l'app. Module PUR (testable sous Node, sans appareil).
 *
 * ```mermaid
 * flowchart LR
 *   O[Orientation : statut recommandé] --> T[Téléphone : code à 6 chiffres]
 *   T --> I[Identité : page Veriff hébergée]
 *   I --> E{Auto-entrepreneur ?}
 *   E -->|oui| S[SIRET : registre public] -->|doute| K[Kbis / extrait RNE / avis Sirene]
 *   S -->|siège = adresse| D
 *   E -->|non| A[Justificatif d'adresse]
 *   A --> D[Demander la vérification]
 *   K --> D
 * ```
 *
 * Règles (docs/tech/L2-verification-identite.md, ADR 0009) :
 * - Koudmen garde le RÉSULTAT, jamais la photo de la pièce, le selfie ni la biométrie.
 * - Justificatifs : chiffrés, supprimés 30 jours après la décision.
 * - Une machine ne refuse jamais seule : « à revoir » = une personne de l'équipe relit.
 * - Textes neutres : jamais « échec ».
 */
import type { z } from 'zod';
// Contrat serveur L2 synchronisé (`src/contracts/verifications.ts`). Chemin relatif : module pur, testé sous Node.
import type {
  canalCodeSchema,
  DossierVerification as DossierVerifications,
  ElementVerification as ItemVerification,
  EtatElement as EtatItem,
  MotifComplement,
  TypeDocument,
  TypeElement as TypeItem,
} from '../contracts';
import { TAILLE_MAX_DOCUMENT as TAILLE_MAX_DOCUMENT_OCTETS, TYPES_DOCUMENT_ACCEPTES as TYPES_MIME_ACCEPTES } from '../contracts';
import { ORDRE_TERRITOIRES, TERRITOIRE_LANCEMENT, TERRITOIRES } from '../territoires/donnees';

export type CanalCode = z.infer<typeof canalCodeSchema>;

// ─────────────── Téléphone ───────────────

/**
 * Préfixes autorisés (§ 5.1, `PHONE_ALLOWED_PREFIXES` côté serveur). Le serveur fait foi : l'app filtre seulement
 * pour dire tout de suite ce qui ne marchera pas.
 * T1 (arbitrage T5) : les préfixes viennent de la configuration des territoires (Guadeloupe +590 690/691 et
 * +590 590, Martinique +596, Guyane +594, Hexagone +33). La Réunion et Mayotte (+262) restent acceptées, comme
 * sur le serveur (numéro libre pour l'accompagnant).
 */
const PREFIXES_HORS_TERRITOIRES = { mobiles: ['+262692', '+262693', '+262639', '+262269'], fixes: ['+262262'] } as const;
export const PREFIXES_MOBILES: readonly string[] = [...ORDRE_TERRITOIRES.flatMap((t) => TERRITOIRES[t].telephone.mobiles), ...PREFIXES_HORS_TERRITOIRES.mobiles];
/** Fixes : pas de SMS, le code arrive par un appel vocal. */
export const PREFIXES_FIXES: readonly string[] = [...ORDRE_TERRITOIRES.flatMap((t) => TERRITOIRES[t].telephone.fixes), ...PREFIXES_HORS_TERRITOIRES.fixes];

/** Exemple de numéro pour les aides et les erreurs (territoire de lancement : « 0690 12 34 56 »). */
export const EXEMPLE_TELEPHONE = TERRITOIRES[TERRITOIRE_LANCEMENT].telephone.exemple;

/** Indicatif d'un numéro national à 10 chiffres (0690…, 0590…, 0696…, 06…). */
const INDICATIFS_NATIONAUX: { debut: RegExp; indicatif: string }[] = [
  { debut: /^0(590|690|691)/, indicatif: '+590' },
  { debut: /^0(596|696|697)/, indicatif: '+596' },
  { debut: /^0(594|694|695)/, indicatif: '+594' },
  { debut: /^0(262|269|692|693|639)/, indicatif: '+262' },
  { debut: /^0[1-79]/, indicatif: '+33' },
];

export type Telephone = { e164: string; genre: 'mobile' | 'fixe' };

/**
 * Saisie libre → E.164. Accepte « 0690 12 34 56 », « +590 690 12 34 56 », « 00590690123456 », « 0696… », « 06… ».
 * Renvoie un message clair si le numéro n'est pas accepté. `exemple` : exemple du territoire choisi.
 */
export function normaliserTelephone(saisie: string, exemple: string = EXEMPLE_TELEPHONE): Telephone | { erreur: string } {
  const incomplet = `Ce numéro n’est pas complet. Exemple : ${exemple}.`;
  let brut = saisie.replace(/[\s.\-()]/g, '');
  if (!brut) return { erreur: 'Entrez votre numéro de téléphone.' };
  if (brut.startsWith('00')) brut = `+${brut.slice(2)}`;
  let e164: string | null = null;
  if (/^\+\d{8,15}$/.test(brut)) e164 = brut;
  else if (/^0\d{9}$/.test(brut)) {
    const regle = INDICATIFS_NATIONAUX.find((r) => r.debut.test(brut));
    if (regle) e164 = `${regle.indicatif}${brut.slice(1)}`;
  }
  if (!e164) return { erreur: incomplet };
  // Numéros français : 9 chiffres après l'indicatif.
  if (/^\+(33|590|594|596|262)/.test(e164) && !/^\+(33|590|594|596|262)\d{9}$/.test(e164)) {
    return { erreur: incomplet };
  }
  if (PREFIXES_MOBILES.some((p) => e164.startsWith(p))) return { e164, genre: 'mobile' };
  if (PREFIXES_FIXES.some((p) => e164.startsWith(p))) return { e164, genre: 'fixe' };
  return { erreur: 'Koudmen accepte les numéros de Guadeloupe, de Martinique, de Guyane, de La Réunion, de Mayotte et de l’Hexagone.' };
}

/** Affichage lisible : +590 690 12 34 56. */
export function formaterTelephone(e164: string): string {
  const m = /^\+(33|590|594|596|262)(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (!m) return e164;
  const [, ind, a, b, c, d, e] = m;
  return ind === '33' ? `+33 ${a} ${b} ${c} ${d} ${e}` : `+${ind} ${a}${b} ${c} ${d} ${e}`;
}

/** Garde seulement les chiffres, 6 au plus (collage d'un SMS, espaces). */
export function nettoyerCode(saisie: string): string {
  return saisie.replace(/\D/g, '').slice(0, 6);
}
export const codeComplet = (code: string) => /^\d{6}$/.test(code);

/** Secondes avant un nouvel envoi (0 = possible maintenant). */
export function secondesAvantRenvoi(renvoiPossibleA: string | null, maintenant: number): number {
  if (!renvoiPossibleA) return 0;
  return Math.max(0, Math.ceil((Date.parse(renvoiPossibleA) - maintenant) / 1000));
}

/** « Recevoir un appel » : pour un fixe, ou quand le serveur le permet (`appelPossible` : après 2 envois par SMS). */
export function appelPropose(genre: Telephone['genre'] | null, appelPossible: boolean): boolean {
  return genre === 'fixe' || appelPossible;
}
export function canalParDefaut(genre: Telephone['genre']): CanalCode {
  return genre === 'fixe' ? 'APPEL' : 'SMS';
}

// ─────────────── SIRET ───────────────

/** Clé de Luhn (SIREN, SIRET). */
export function luhnValide(chiffres: string): boolean {
  if (!/^\d+$/.test(chiffres)) return false;
  let somme = 0;
  for (let i = 0; i < chiffres.length; i++) {
    let n = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

/**
 * Saisie → SIRET de 14 chiffres, contrôlé avant l'envoi.
 * Exception connue : les établissements de La Poste (SIREN 356000000) ont une autre règle.
 */
export function normaliserSiret(saisie: string): { siret: string } | { erreur: string } {
  const s = saisie.replace(/[\s.]/g, '');
  if (!s) return { erreur: 'Entrez votre numéro SIRET.' };
  if (!/^\d+$/.test(s)) return { erreur: 'Le SIRET contient seulement des chiffres.' };
  if (s.length === 9) return { erreur: 'Ce numéro a 9 chiffres : c’est le SIREN. Entrez le SIRET, qui a 14 chiffres.' };
  if (s.length !== 14) return { erreur: `Le SIRET a 14 chiffres. Vous en avez entré ${s.length}.` };
  const poste = s.startsWith('356000000') && [...s].reduce((t, c) => t + Number(c), 0) % 5 === 0;
  if (!poste && !luhnValide(s)) return { erreur: 'Ce SIRET n’est pas valable. Vérifiez chaque chiffre sur votre avis de situation.' };
  return { siret: s };
}

export function formaterSiret(siret: string): string {
  return siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4');
}

// ─────────────── Documents ───────────────

export type FichierChoisi = {
  uri: string;
  nom: string;
  /** Type MIME annoncé par le téléphone. */
  type: string;
  /** Taille en octets, si connue. */
  taille?: number;
};


/** Contrôle avant l'envoi (le serveur refait le contrôle sur les premiers octets du fichier). */
export function controlerFichier(f: Pick<FichierChoisi, 'type' | 'taille' | 'nom'>): string | null {
  const type = (f.type || mimeDepuisNom(f.nom) || '').toLowerCase();
  if (!(TYPES_MIME_ACCEPTES as readonly string[]).includes(type)) return 'Ce type de fichier n’est pas accepté. Envoyez un PDF ou une photo (JPEG, PNG).';
  if (f.taille !== undefined && f.taille > TAILLE_MAX_DOCUMENT_OCTETS) return 'Ce fichier est trop gros (5 Mo au plus). Prenez une photo à la place.';
  return null;
}

/**
 * L2b (revue m6) : la copie du justificatif dans le cache de l'app est effacée après l'envoi.
 * Seulement un fichier DANS le cache de l'app (jamais l'original de la galerie ou d'un dossier du téléphone).
 */
export function copieEnCache(uri: string, dossierCache: string | null | undefined): boolean {
  if (!dossierCache || !uri.startsWith('file://') || !dossierCache.startsWith('file://')) return false;
  const dossier = dossierCache.endsWith('/') ? dossierCache : `${dossierCache}/`;
  return uri.startsWith(dossier) && uri.length > dossier.length && !uri.includes('/../') && !uri.includes('%2e%2e') && !uri.includes('%2E%2E');
}

export function mimeDepuisNom(nom: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(nom)?.[1]?.toLowerCase();
  const table: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  return ext ? (table[ext] ?? null) : null;
}

export function formaterTaille(octets: number | undefined): string {
  if (octets === undefined) return '';
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export const LIBELLES_DOCUMENT: Record<TypeDocument, string> = {
  KBIS: 'Extrait Kbis',
  EXTRAIT_RNE: 'Extrait RNE',
  AVIS_SIRENE: 'Avis de situation Sirene',
  JUSTIFICATIF_DOMICILE: 'Justificatif de domicile',
  ATTESTATION_HEBERGEMENT: 'Attestation d’hébergement',
};

export const AIDE_DOCUMENT: Record<TypeDocument, string> = {
  KBIS: 'Pour une société ou un commerçant inscrit au registre du commerce. Moins de 3 mois.',
  EXTRAIT_RNE: 'Gratuit sur l’Annuaire des entreprises ou sur le site de l’INPI. Moins de 3 mois.',
  AVIS_SIRENE: 'Gratuit sur le site de l’INSEE. Le plus simple pour une micro-entreprise.',
  JUSTIFICATIF_DOMICILE:
    'Facture d’électricité, d’eau, d’internet ou de téléphone fixe, dernier avis d’impôt, quittance de loyer ou assurance habitation. À votre nom, moins de 3 mois.',
  ATTESTATION_HEBERGEMENT: 'Vous habitez chez une autre personne : attestation signée par elle. Sa pièce d’identité se montre en visio, jamais envoyée.',
};

/** Documents proposés pour chaque élément. */
export const DOCUMENTS_ITEM: Partial<Record<TypeItem, TypeDocument[]>> = {
  ADRESSE: ['JUSTIFICATIF_DOMICILE', 'ATTESTATION_HEBERGEMENT'],
  ENTREPRISE: ['AVIS_SIRENE', 'EXTRAIT_RNE', 'KBIS'],
};

// ─────────────── Éléments : textes et parcours ───────────────

/** Éléments que l'app fait faire (dans cet ordre). Les autres : sur le site, ou à montrer en visio. */
export const ITEMS_DANS_L_APP: TypeItem[] = ['TELEPHONE', 'IDENTITE', 'ENTREPRISE', 'ADRESSE'];

/** Pourquoi Koudmen demande chaque pièce (phrase courte, voix active). Le libellé vient du serveur. */
export const POURQUOI_ITEM: Record<TypeItem, string> = {
  TELEPHONE: 'L’équipe et les familles vous joignent à ce numéro. En cas d’alerte, Koudmen vous prévient par SMS.',
  IDENTITE: 'Vous entrez chez une personne âgée. La famille doit savoir qui vient à la porte.',
  ADRESSE: 'L’équipe vous joint en cas de problème. La famille en a besoin pour la déclaration CESU. Elle voit seulement votre commune.',
  ENTREPRISE: 'Koudmen vérifie que votre micro-entreprise est active, à votre nom, dans le registre public.',
  CASIER_B3: 'Vous le montrez à l’équipe en visio. Koudmen ne garde aucune copie.',
  REFERENCES: 'L’équipe appelle deux personnes qui vous connaissent.',
  FORMATION: 'Une courte formation sur les gestes et les règles Koudmen.',
  STATUT_PRO: 'Votre déclaration de services à la personne.',
  PSC1: 'Votre formation aux premiers secours.',
  DIPLOME: 'Votre diplôme d’aide à la personne (niveau 4 seulement).',
};

/** Ce que Koudmen garde, et ce qu'il ne garde pas. */
export const CE_QUE_KOUDMEN_GARDE: Partial<Record<TypeItem, { garde: string; neGardePas: string }>> = {
  TELEPHONE: { garde: 'Votre numéro, chiffré.', neGardePas: 'Le code reçu par SMS.' },
  IDENTITE: {
    garde: 'Le résultat : identité confirmée ou non, votre nom et votre date de naissance.',
    neGardePas: 'La photo de votre pièce, votre selfie, la vidéo. Ils restent chez Veriff et sont effacés au plus tard 30 jours après la décision.',
  },
  ADRESSE: {
    garde: 'Votre adresse et le résultat de la relecture (« adresse conforme »).',
    neGardePas: 'Le fichier au-delà de 30 jours après la décision. Il est chiffré. Seule l’équipe Koudmen le lit.',
  },
  ENTREPRISE: {
    garde: 'Le résultat du registre public (active, nom conforme).',
    neGardePas: 'Le document envoyé au-delà de 30 jours après la décision.',
  },
};

export const MOTIFS_COMPLEMENT: Record<MotifComplement, string> = {
  ILLISIBLE: 'Le document est difficile à lire. Envoyez une photo plus nette, à plat, avec de la lumière.',
  TROP_ANCIEN: 'Le document a plus de 3 mois. Envoyez un document plus récent.',
  NOM_DIFFERENT: 'Le nom sur le document n’est pas le vôtre. Envoyez un document à votre nom.',
  ADRESSE_DIFFERENTE: 'L’adresse sur le document n’est pas celle de votre profil. Envoyez un document avec la bonne adresse.',
  TYPE_NON_ACCEPTE: 'Ce type de document n’est pas accepté. Choisissez un document de la liste.',
  PAGE_MANQUANTE: 'Il manque une page. Envoyez le document complet.',
  REPRENDRE_PHOTO: 'La photo de la pièce n’est pas lisible. Recommencez avec une photo nette, sans reflet.',
  DATE_NAISSANCE_DIFFERENTE: 'La date de naissance de la pièce n’est pas celle de votre profil. L’équipe vous contacte.',
};

/** Libellé neutre de l'état (jamais « échec »). Le mot accompagne toujours la couleur. */
export function libelleEtat(item: Pick<ItemVerification, 'type' | 'etat' | 'methode'>): string {
  switch (item.etat) {
    case 'VALIDE':
      return item.methode === 'AUTO_REGISTRE' && item.type === 'ADRESSE' ? 'Fait (adresse du siège)' : 'Fait';
    case 'EN_COURS':
      if (item.type === 'IDENTITE') return item.methode === 'VISIO' ? 'Visio demandée' : 'Vérification en cours';
      return item.type === 'TELEPHONE' ? 'Code envoyé' : 'En revue par l’équipe';
    case 'A_REVOIR':
      return 'Relu par l’équipe';
    case 'DECLARE':
      return 'À montrer en visio';
    case 'EXPIRE':
      return 'À renouveler';
    case 'REFUSE':
      return 'Non retenu';
    case 'A_FOURNIR':
    default:
      return 'À faire';
  }
}

export type TonEtat = 'preuve' | 'soleil' | 'neutre' | 'mer' | 'alerte';
export function tonEtat(etat: EtatItem): TonEtat {
  if (etat === 'VALIDE') return 'preuve';
  if (etat === 'EN_COURS' || etat === 'A_REVOIR' || etat === 'DECLARE') return 'mer';
  if (etat === 'REFUSE') return 'alerte';
  return 'soleil';
}

/** Écran de l'app pour un élément, ou `null` (site, visio). Le serveur décide par `actionSuivante`. */
export type EcranItem = '/dossier/telephone' | '/dossier/identite' | '/dossier/entreprise' | '/dossier/adresse';
const ECRAN_PAR_TYPE: Partial<Record<TypeItem, EcranItem>> = {
  TELEPHONE: '/dossier/telephone',
  IDENTITE: '/dossier/identite',
  ENTREPRISE: '/dossier/entreprise',
  ADRESSE: '/dossier/adresse',
};
export function ecranItem(item: Pick<ItemVerification, 'type' | 'actionSuivante' | 'surLeSite'>): EcranItem | null {
  switch (item.actionSuivante) {
    case 'VERIFIER_TELEPHONE':
      return '/dossier/telephone';
    case 'VERIFIER_IDENTITE':
      return '/dossier/identite';
    case 'SAISIR_SIRET':
    case 'TELEVERSER_DOCUMENT_ENTREPRISE':
      return '/dossier/entreprise';
    case 'SAISIR_ADRESSE':
    case 'TELEVERSER_JUSTIFICATIF':
      return '/dossier/adresse';
    case 'DECLARER_SUR_LE_SITE':
    case 'MONTRER_EN_VISIO':
      return null;
    default:
      // ATTENDRE, AUCUNE : l'écran s'ouvre encore pour lire l'état (identité en cours, document en revue).
      return item.surLeSite ? null : (ECRAN_PAR_TYPE[item.type] ?? null);
  }
}

/** L'élément demande une action de l'accompagnant maintenant. */
export function aFaire(item: Pick<ItemVerification, 'etat' | 'actionSuivante'>): boolean {
  if (item.actionSuivante === 'ATTENDRE' || item.actionSuivante === 'AUCUNE') return false;
  return item.etat === 'A_FOURNIR' || item.etat === 'EXPIRE';
}

/** Éléments faits dans l'app, dans l'ordre du parcours ; autres éléments (site, visio). */
export function trierItems(d: Pick<DossierVerifications, 'items'>): { app: ItemVerification[]; autres: ItemVerification[] } {
  const rang = (t: TypeItem) => ITEMS_DANS_L_APP.indexOf(t);
  const app = d.items.filter((i) => rang(i.type) >= 0 && !i.surLeSite).sort((a, b) => rang(a.type) - rang(b.type));
  const autres = d.items.filter((i) => !app.includes(i));
  return { app, autres };
}

/** Prochain élément obligatoire à faire dans l'app (bouton principal), dans l'ordre du parcours. */
export function prochainItem(d: Pick<DossierVerifications, 'items'>): ItemVerification | null {
  return trierItems(d).app.find((i) => i.obligatoire && aFaire(i)) ?? null;
}

/** Après 3 sessions d'identité sans succès, le serveur met `sessionsIdentiteRestantes` à 0 : l'app propose la visio. */
export const MAX_SESSIONS_IDENTITE = 3;
