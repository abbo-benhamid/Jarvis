import { demandeInscriptionSchema, type ControleCheckIn } from '@/contracts';
import {
  ageEnAnnees,
  AGE_MIN_ACCOMPAGNANT,
  DISTANCE_ARRIVEE_M,
  DUREE_MAX_TRAJET_MIN,
  PREFIXE_QR_SIGNE,
  type DomicileTrajet,
} from './l1';
import {
  demandeAdresseSchema,
  demandeCodeTelephoneSchema,
  demandeOrientationSchema,
  type DossierVerification,
  type ElementVerification,
  type EtatVerification,
  type ResultatOrientation,
  type TypeElement,
} from '@/contracts';
import { codeComplet, controlerFichier, MAX_SESSIONS_IDENTITE, normaliserSiret, normaliserTelephone } from '@/compte/verifications';
import { orienterLocalement } from '@/compte/orientation';
import { trouverCommune } from '@/lib/communes';
import { distanceMetres } from '@/lib/geo';
import type { KoudmenApi } from './client';
import { MESSAGES } from './messages';
import { nouvelIdEvenement } from './pkce';
import {
  ApiError,
  SEUIL_PREUVE,
  type BrouillonKaye,
  type FacteurPreuve,
  type Moi,
  type Proposition,
  type ReponseVisite,
  type ResultatEvenement,
  type Visite,
} from './types';

/**
 * Implémentation SIMULÉE (tests hors ligne, `EXPO_PUBLIC_API_MODE=simule`).
 * Mêmes formes que l'API v1 (contrats Zod). Données en mémoire, perdues au redémarrage.
 * L1 : plus de « compte de démonstration ». Tout e-mail valide + le mot de passe simulé ouvre une session.
 */

/** Mot de passe accepté par l'API simulée (tests seulement, jamais affiché en mode réel). */
export const MOT_DE_PASSE_SIMULE = 'koudmen';
/**
 * Code du domicile de Léonie dans les données simulées, le MÊME que dans les données d'exemple du site
 * (plateforme/prisma/seed.ts, `homeCode: "LKW7Q3"`, aligné P14). Arbitrage V1 X3 : un seul code par domicile,
 * écrit en clair et en QR sur la même feuille ; l'app le scanne OU le saisit.
 */
export const CODE_DOMICILE_SIMULE = 'LKW7Q3';

/**
 * QR signé SIMULÉ de la carte domicile de Léonie (L9 : `koudmen:domicile:s1:<jeton>`).
 * L'API simulée accepte tout jeton bien formé, sauf s'il contient « revoque » (carte régénérée : refus).
 */
export const QR_SIGNE_SIMULE = `${PREFIXE_QR_SIGNE}eyJhIjoiYWluZV9sZW9uaWUiLCJ2IjoxfQ.c2lnbmF0dXJlLXNpbXVsZWU`;

/** Domicile simulé de Léonie (Terres-Sainville, Fort-de-France). Position précise : `approximatif: false`. */
export const DOMICILE_SIMULE: DomicileTrajet = { latitude: 14.6085, longitude: -61.068, approximatif: false };

/**
 * Journal de l'API simulée, lu par les tests e2e (`globalThis.__KOUDMEN_API_JOURNAL__`).
 * Aucun mot de passe. Positions du trajet telles qu'envoyées (déjà arrondies par l'app).
 */
export type JournalApiSimulee = {
  inscriptions: { email: string; commune: string; dateNaissance: string }[];
  motsDePasseOublies: string[];
  trajets: { visiteId: string; action: 'DEMARRER' | 'ARRETER' }[];
  positions: { visiteId: string; latitude: number; longitude: number; precisionMetres: number; simulee: boolean }[];
  checkIns: { visiteId: string; qr: boolean; code: boolean; position: boolean; simulee: boolean }[];
  /** D15 : orientations envoyées (issue seulement) et demandes de vérification. */
  orientations: { email: string; issue: string }[];
  demandesVerification: string[];
  /** L2 : jamais de code, de photo, d'adresse ni de contenu de fichier. Numéro réduit aux 4 derniers chiffres. */
  codesTelephone: { canal: string; fin: string }[];
  confirmationsTelephone: number;
  sessionsIdentite: number;
  decisionsIdentite: string[];
  visios: string[];
  adresses: number;
  entreprises: string[];
  documents: { type: string; mime: string; taille: number | null }[];
  soumissions: string[];
};

function journalApi(): JournalApiSimulee {
  const g = globalThis as { __KOUDMEN_API_JOURNAL__?: JournalApiSimulee };
  g.__KOUDMEN_API_JOURNAL__ ??= { inscriptions: [], motsDePasseOublies: [], trajets: [], positions: [], checkIns: [], orientations: [],
    demandesVerification: [],
    codesTelephone: [],
    confirmationsTelephone: 0,
    sessionsIdentite: 0,
    decisionsIdentite: [],
    visios: [],
    adresses: 0,
    entreprises: [],
    documents: [],
    soumissions: [],
  };
  return g.__KOUDMEN_API_JOURNAL__;
}

const attendre = (ms = 280) => new Promise<void>((r) => setTimeout(r, ms));

/** Maintenant + décalage en minutes. */
const dans = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
/** Date du jour + décalage en jours, à l'heure donnée (heure locale). */
function a(jours: number, h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const MOI: Moi = {
  id: 'acc_josiane',
  role: 'ACCOMPAGNANT',
  prenom: 'Josiane',
  nom: 'Mathurin',
  email: 'josiane.mathurin@exemple.fr',
  demo: false,
  bacASable: false,
  emailVerifie: true,
  profilValide: true,
  preinscription: false,
};

/**
 * Comptes particuliers pour les tests (e-mail → état du compte). Tout autre e-mail ouvre le compte de Josiane.
 * Un compte créé par `inscrire` a l'e-mail non vérifié et le profil en validation.
 */
const COMPTES_TEST: Record<string, Partial<Moi>> = {
  'en-validation@exemple.fr': { prenom: 'Marius', nom: 'Rosette', emailVerifie: true, profilValide: false },
  'email-a-verifier@exemple.fr': { emailVerifie: false },
  'preinscription@exemple.fr': { preinscription: true },
  // D15 : préinscription ET profil à valider (même parcours que « en validation », avec le bandeau « ouvre bientôt »).
  'preinscription-validation@exemple.fr': { prenom: 'Lucette', nom: 'Boré', profilValide: false, preinscription: true },
  'demande-envoyee@exemple.fr': { prenom: 'Gisèle', nom: 'Adèle', profilValide: false },
};

// ─────────────── L2 : vérification simulée ───────────────

/** Code accepté par l'API simulée (§ 8.1 : code fixe `000000` en démo). */
export const CODE_SMS_SIMULE = '000000';
/**
 * SIRET de test (clé de Luhn valable, numéros fictifs) :
 * actif et siège = adresse déclarée ; cessé ; nom caché au registre ; nom différent.
 * Tout autre SIRET valable : actif, nom conforme, siège différent (justificatif d'adresse demandé).
 */
export const SIRET_SIMULES = { conforme: '90100000000009', cesse: '90200000000007', nomCache: '90300000000005', nomDifferent: '90400000000003' } as const;

/** Réglages des tests e2e (`globalThis.__KOUDMEN_VERIF__`). */
function reglagesVerif(): { delaiRenvoiS: number } {
  const g = globalThis as { __KOUDMEN_VERIF__?: { delaiRenvoiS?: number } };
  return { delaiRenvoiS: g.__KOUDMEN_VERIF__?.delaiRenvoiS ?? 60 };
}

/** Éléments requis par statut (§ 6.1). B3 et références : à montrer en visio (déjà déclarés en mode simulé). */
const ITEMS_PAR_STATUT: Record<string, TypeElement[]> = {
  SALARIE_FAMILLE_CESU: ['TELEPHONE', 'IDENTITE', 'ADRESSE', 'CASIER_B3', 'REFERENCES'],
  PROCHE_AIDANT_APA: ['TELEPHONE', 'IDENTITE', 'ADRESSE', 'CASIER_B3', 'REFERENCES'],
  AUTO_ENTREPRENEUR_SAP: ['TELEPHONE', 'IDENTITE', 'ENTREPRISE', 'ADRESSE', 'CASIER_B3', 'REFERENCES', 'STATUT_PRO'],
  BENEVOLE_ASSO: ['TELEPHONE'],
  SAAD: ['TELEPHONE', 'IDENTITE', 'ENTREPRISE'],
};
const DANS_L_APP = ['TELEPHONE', 'IDENTITE', 'ENTREPRISE', 'ADRESSE'] as const;
const LIBELLE_ELEMENT: Record<TypeElement, string> = {
  TELEPHONE: 'Mon téléphone',
  IDENTITE: 'Mon identité',
  ADRESSE: 'Mon adresse',
  ENTREPRISE: 'Mon entreprise (SIRET)',
  CASIER_B3: 'Extrait de casier judiciaire (B3)',
  REFERENCES: 'Deux références',
  FORMATION: 'Formation Koudmen',
  STATUT_PRO: 'Déclaration de services à la personne',
  PSC1: 'Formation aux premiers secours',
  DIPLOME: 'Diplôme d’aide à la personne',
};
const ACTION_DEPART: Record<TypeElement, ElementVerification['actionSuivante']> = {
  TELEPHONE: 'VERIFIER_TELEPHONE',
  IDENTITE: 'VERIFIER_IDENTITE',
  ENTREPRISE: 'SAISIR_SIRET',
  ADRESSE: 'SAISIR_ADRESSE',
  CASIER_B3: 'MONTRER_EN_VISIO',
  REFERENCES: 'MONTRER_EN_VISIO',
  FORMATION: 'MONTRER_EN_VISIO',
  STATUT_PRO: 'MONTRER_EN_VISIO',
  PSC1: 'MONTRER_EN_VISIO',
  DIPLOME: 'MONTRER_EN_VISIO',
};
/** Phrase neutre du serveur (simulée). Jamais « échec ». */
function messageElement(i: Pick<ElementVerification, 'type' | 'etat' | 'actionSuivante' | 'methode'>): string {
  if (i.etat === 'VALIDE') return 'C’est fait. Merci.';
  if (i.etat === 'A_REVOIR') return 'Une personne de l’équipe relit ce point. Elle vous contacte si besoin.';
  if (i.etat === 'DECLARE') return 'Vous le montrez à l’équipe pendant la visio.';
  if (i.etat === 'EN_COURS') return i.methode === 'VISIO' ? 'L’équipe vous appelle pour fixer l’heure de la visio.' : 'Koudmen vérifie. Vous n’avez rien à faire.';
  switch (i.actionSuivante) {
    case 'TELEVERSER_JUSTIFICATIF':
      return 'Envoyez un justificatif de domicile de moins de 3 mois.';
    case 'TELEVERSER_DOCUMENT_ENTREPRISE':
      return 'Envoyez un avis de situation Sirene, un extrait RNE ou un Kbis.';
    default:
      return 'À faire dans l’app.';
  }
}
type EtatL2 = {
  items: Map<TypeElement, ElementVerification>;
  defi: { id: string; renvoiA: number; essais: number; numero: string } | null;
  envoisSms: number;
  sessions: number;
  telephoneMasque: string | null;
};
function nouvelElement(type: TypeElement): ElementVerification {
  const dansApp = (DANS_L_APP as readonly TypeElement[]).includes(type);
  const base = {
    id: `el${type.toLowerCase().replace(/_/g, '')}`,
    type,
    etat: (dansApp ? 'A_FOURNIR' : 'DECLARE') as ElementVerification['etat'],
    methode: null,
    obligatoire: true,
    libelle: LIBELLE_ELEMENT[type],
    expireLe: null,
    actionSuivante: ACTION_DEPART[type],
    motifComplement: null,
    surLeSite: false,
  };
  return { ...base, message: messageElement(base) };
}
/** « +596 696 •• •• 56 ». */
function masquer(e164: string): string {
  const m = /^\+(\d{2,3})(\d{3})\d{4}(\d{2})$/.exec(e164);
  return m ? `+${m[1]} ${m[2]} •• •• ${m[3]}` : '•• •• ••';
}

/**
 * D15 : état de vérification simulé, même calcul que le serveur (`verification-app.ts`, F1).
 * Le mode simulé n'a pas de profil web : communes, disponibilités, tarif et pièces comptent comme faits.
 */
type BaseVerification = { validation: EtatVerification['validation']; orientation: ResultatOrientation | null; raison: string | null };
export function etatVerificationSimule(b: BaseVerification, elements: ElementVerification[] = []): EtatVerification {
  const recommande = b.orientation?.issue === 'RECOMMANDE';
  const envoyee = b.validation === 'EN_ATTENTE' || b.validation === 'VALIDE';
  // L2 : une étape par élément fait dans l'app (TELEPHONE, IDENTITE, ENTREPRISE, ADRESSE), comme le serveur.
  const fait = (e: ElementVerification) => e.etat === 'VALIDE' || e.etat === 'EN_COURS' || e.etat === 'A_REVOIR' || e.etat === 'DECLARE';
  const etapesL2 = DANS_L_APP.flatMap((t) => {
    const e = elements.find((x) => x.type === t);
    return e ? [{ code: t, libelle: e.libelle, faite: fait(e), surLeSite: false }] : [];
  });
  const elementsOk = etapesL2.every((e) => e.faite);
  return {
    validation: b.validation,
    orientation: b.orientation,
    etapes: [
      { code: 'ORIENTATION', libelle: 'Répondre aux 5 questions', faite: recommande, surLeSite: false },
      { code: 'PROFIL', libelle: 'Communes, disponibilités et tarif', faite: recommande, surLeSite: true },
      ...etapesL2,
      { code: 'PIECES', libelle: 'Déclarer vos pièces', faite: recommande, surLeSite: true },
      { code: 'DEMANDE', libelle: 'Demander la vérification', faite: envoyee, surLeSite: false },
      { code: 'APPEL_EQUIPE', libelle: 'Appel de l’équipe Koudmen, puis validation', faite: b.validation === 'VALIDE', surLeSite: false },
    ],
    manque: [],
    raison: b.validation === 'REFUSE' || b.validation === 'SUSPENDU' ? b.raison : null,
    peutDemander: recommande && elementsOk && (b.validation === 'BROUILLON' || b.validation === 'REFUSE'),
  };
}

/** D15 : état de vérification de départ des comptes de test. */
const VERIFICATION_TEST: Record<string, BaseVerification> = {
  'demande-envoyee@exemple.fr': {
    validation: 'EN_ATTENTE',
    orientation: orienterLocalement({ activity: 'LIEN', paid: true, existingStatus: 'AUCUN', situations: [], familyLink: 'AUCUN' }),
    raison: null,
  },
};
const VERIFICATION_VIDE: BaseVerification = { validation: 'BROUILLON', orientation: null, raison: null };

function visite(id: string, debut: string, finMin: number, aine: Partial<Visite['aine']>, consignes: string, checkIn: boolean): Visite {
  return {
    id,
    debut,
    fin: new Date(new Date(debut).getTime() + finMin * 60_000).toISOString(),
    statut: 'PREVUE',
    // Même personne fictive que la démo du site : Léonie J., Terres-Sainville, Fort-de-France.
    aine: {
      prenom: 'Léonie',
      initialeNom: 'J.',
      commune: 'FORT_DE_FRANCE',
      communeLibelle: 'Fort-de-France',
      adresseApproximative: 'Quartier Terres-Sainville',
      interets: [],
      ...aine,
    },
    demande: { niveau: 1, frequence: 'HEBDOMADAIRE', dureeMinutes: finMin, consignes },
    preuve: { score: 0, seuil: SEUIL_PREUVE, facteursValides: [], checkInA: null, checkOutA: null, horlogeSuspecte: false },
    kayePublie: false,
    actions: { checkIn, checkOut: false, kaye: false },
  };
}

function donneesInitiales(): Visite[] {
  return [
    visite('vis_leonie_j0', dans(-10), 120, { interets: ['Dominos', 'Son jardin'] }, 'Marché de Rivière-Pilote, puis le courrier de la CGSS.', true),
    visite(
      'vis_alphonse_j0',
      a(0, 17),
      90,
      { prenom: 'Alphonse', initialeNom: 'D.', commune: 'RIVIERE_PILOTE', communeLibelle: 'Rivière-Pilote', adresseApproximative: 'Bourg', interets: ['Radio', 'Football'] },
      'Promenade courte et lecture du journal.',
      false,
    ),
    visite('vis_leonie_j2', a(2, 9, 30), 90, {}, 'Rendez-vous chez le pharmacien du bourg.', false),
    visite(
      'vis_marceline_j3',
      a(3, 14),
      120,
      { prenom: 'Marceline', initialeNom: 'L.', commune: 'SAINTE_LUCE', communeLibelle: 'Sainte-Luce', adresseApproximative: 'Trois-Rivières' },
      'Courses au marché, puis un café ensemble.',
      false,
    ),
  ];
}

function propositionsInitiales(): Proposition[] {
  return [
    {
      id: 'prop_ginette',
      message: 'Ginette habite près de chez vous. Sa fille cherche une visite le mardi matin.',
      creeLe: dans(-120),
      aine: { prenom: 'Ginette', commune: 'LAMENTIN', communeLibelle: 'Le Lamentin' },
      demande: { niveau: 1, frequence: 'HEBDOMADAIRE', dureeMinutes: 90, debut: null, consignes: 'Discussion et petite marche.', creneaux: [{ jour: 1, creneau: 'MATIN' }] },
      visitesPrevues: 4,
    },
    {
      id: 'prop_rene',
      message: null,
      creeLe: dans(-30),
      aine: { prenom: 'René', commune: 'SAINTE_LUCE', communeLibelle: 'Sainte-Luce' },
      demande: { niveau: 2, frequence: 'DEUX_PAR_SEMAINE', dureeMinutes: 120, debut: a(7, 0), consignes: null, creneaux: [{ jour: 2, creneau: 'APRES_MIDI' }, { jour: 4, creneau: 'APRES_MIDI' }] },
      visitesPrevues: 8,
    },
  ];
}

export function creerApiSimulee(): KoudmenApi {
  let session: Moi | null = null;
  let visites = donneesInitiales();
  let propositions = propositionsInitiales();
  const brouillons = new Map<string, BrouillonKaye>();
  /** Comptes créés par `inscrire` (mémoire). */
  const comptes = new Map<string, { motDePasse: string; moi: Moi }>();
  /** Trajets en cours : visite → fin automatique (ms). Aucune position gardée (L6 : pas d'historique). */
  const trajets = new Map<string, number>();
  /** D15 : état de vérification par e-mail (gardé après la déconnexion, comme sur le serveur). */
  const verifications = new Map<string, BaseVerification>();
  const verificationDe = (email: string): BaseVerification => verifications.get(email) ?? VERIFICATION_TEST[email] ?? VERIFICATION_VIDE;
  /** L2 : dossier de vérification par e-mail. */
  const dossiers = new Map<string, EtatL2>();
  const emailSession = () => {
    exigerSession();
    return (session as Moi).email;
  };
  /** Éléments selon le statut recommandé. Un changement de statut ajoute ou retire des éléments, garde les autres. */
  const dossierDe = (email: string): EtatL2 => {
    let d = dossiers.get(email);
    if (!d) {
      d = { items: new Map(), defi: null, envoisSms: 0, sessions: 0, telephoneMasque: null };
      dossiers.set(email, d);
    }
    const o = verificationDe(email).orientation;
    const types = o?.issue === 'RECOMMANDE' && o.statut ? (ITEMS_PAR_STATUT[o.statut] ?? []) : [];
    for (const t of [...d.items.keys()]) if (!types.includes(t)) d.items.delete(t);
    for (const t of types) if (!d.items.has(t)) d.items.set(t, nouvelElement(t));
    return d;
  };
  const majItem = (email: string, type: TypeElement, patch: Partial<ElementVerification>) => {
    const d = dossierDe(email);
    const it = d.items.get(type);
    if (!it) return;
    const nv = { ...it, ...patch };
    d.items.set(type, { ...nv, message: messageElement(nv) });
  };
  const vueDossier = (email: string): DossierVerification => {
    const d = dossierDe(email);
    const items = [...d.items.values()];
    const manquants = items.filter((i) => i.obligatoire && (i.etat === 'A_FOURNIR' || i.etat === 'EXPIRE'));
    const base = verificationDe(email);
    return {
      dossier: { etat: base.validation, motif: null, recoursPossible: false },
      items,
      peutSoumettre: base.orientation?.issue === 'RECOMMANDE' && manquants.length === 0 && (base.validation === 'BROUILLON' || base.validation === 'REFUSE'),
      manque: manquants.map((i) => i.libelle),
      sessionsIdentiteRestantes: Math.max(0, MAX_SESSIONS_IDENTITE - d.sessions),
      telephoneMasque: d.telephoneMasque,
    };
  };
  const etatD15 = (email: string) => etatVerificationSimule(verificationDe(email), [...dossierDe(email).items.values()]);
  const domicileDe = (v: Visite): DomicileTrajet | null => {
    if (v.id === 'vis_leonie_j0') return DOMICILE_SIMULE;
    const c = trouverCommune(v.aine.commune);
    return c ? { latitude: c.lat, longitude: c.lng, approximatif: true } : null;
  };

  const exigerSession = () => {
    if (!session) throw new ApiError('NON_AUTHENTIFIE', MESSAGES.NON_AUTHENTIFIE, 401);
  };
  const trouver = (id: string): Visite => {
    const v = visites.find((x) => x.id === id);
    if (!v) throw new ApiError('INTROUVABLE', MESSAGES.INTROUVABLE, 404);
    return v;
  };
  const remplacer = (v: Visite) => {
    visites = visites.map((x) => (x.id === v.id ? v : x));
    return v;
  };
  const resultat = (type: ResultatEvenement['type'], v?: Visite, extra: Partial<ResultatEvenement> = {}): ResultatEvenement => ({
    clientEventId: nouvelIdEvenement(),
    type,
    statut: 'ACCEPTE',
    horlogeSuspecte: false,
    ...(v ? { visite: { id: v.id, statut: v.statut, score: v.preuve.score } } : {}),
    ...extra,
  });

  return {
    mode: 'simule',
    url: null,

    async connecter(email, motDePasse) {
      await attendre();
      const e = email.trim().toLowerCase();
      const compte = comptes.get(e);
      if (!e.includes('@') || (compte ? compte.motDePasse !== motDePasse : motDePasse !== MOT_DE_PASSE_SIMULE)) {
        throw new ApiError('IDENTIFIANTS_INVALIDES', MESSAGES.IDENTIFIANTS_INVALIDES, 401);
      }
      session = compte ? compte.moi : { ...MOI, ...(COMPTES_TEST[e] ?? {}), email: e };
      return session;
    },

    async inscrire(demande) {
      await attendre(400);
      const ok = demandeInscriptionSchema.safeParse({ role: 'ACCOMPAGNANT', ...demande });
      if (!ok.success) throw new ApiError('REQUETE_INVALIDE', ok.error.issues[0]?.message ?? MESSAGES.REQUETE_INVALIDE, 400);
      if (ageEnAnnees(ok.data.dateNaissance) < AGE_MIN_ACCOMPAGNANT) {
        throw new ApiError('REQUETE_INVALIDE', 'Il faut avoir 18 ans ou plus pour devenir accompagnant.', 400);
      }
      if (/^(motdepasse|koudmen123|azerty|0123456789)/i.test(ok.data.motDePasse)) {
        throw new ApiError('REQUETE_INVALIDE', 'Ce mot de passe est trop courant. Choisissez-en un autre.', 400);
      }
      journalApi().inscriptions.push({ email: ok.data.email, commune: ok.data.commune, dateNaissance: ok.data.dateNaissance });
      // Même réponse si l'e-mail existe déjà (pas de fuite) : le compte existant ne change pas.
      if (!comptes.has(ok.data.email)) {
        comptes.set(ok.data.email, {
          motDePasse: ok.data.motDePasse,
          moi: {
            id: `acc_${comptes.size + 1}`,
            role: 'ACCOMPAGNANT',
            prenom: ok.data.prenom,
            nom: ok.data.nom,
            email: ok.data.email,
            demo: false,
            bacASable: false,
            emailVerifie: false,
            profilValide: false,
            preinscription: false,
          },
        });
      }
    },
    async motDePasseOublie(email) {
      await attendre(300);
      journalApi().motsDePasseOublies.push(email.trim().toLowerCase());
    },
    async restaurer() {
      return session;
    },
    async moi() {
      exigerSession();
      return session as Moi;
    },
    async deconnecter() {
      await attendre(120);
      session = null;
      trajets.clear();
      visites = donneesInitiales();
      propositions = propositionsInitiales();
      brouillons.clear();
    },
    surSessionPerdue: () => () => undefined,

    async lireVerification() {
      await attendre(200);
      exigerSession();
      return etatD15((session as Moi).email);
    },
    async envoyerOrientation(reponses) {
      await attendre(350);
      exigerSession();
      const ok = demandeOrientationSchema.safeParse(reponses);
      if (!ok.success) throw new ApiError('REQUETE_INVALIDE', MESSAGES.REQUETE_INVALIDE, 400);
      const email = (session as Moi).email;
      const avant = verificationDe(email);
      if (avant.validation === 'VALIDE' || avant.validation === 'SUSPENDU') {
        throw new ApiError('ACTION_IMPOSSIBLE', 'Votre profil est validé. Pour changer de statut, écrivez à l’équipe Koudmen.', 422);
      }
      const orientation = orienterLocalement(ok.data);
      journalApi().orientations.push({ email, issue: orientation.issue });
      // Comme le site : refaire l'orientation pendant la vérification renvoie le profil en brouillon.
      verifications.set(email, { ...avant, orientation, validation: avant.validation === 'EN_ATTENTE' ? 'BROUILLON' : avant.validation });
      return orientation;
    },
    async demanderVerification() {
      await attendre(350);
      exigerSession();
      const email = (session as Moi).email;
      const avant = verificationDe(email);
      if (avant.validation === 'EN_ATTENTE') throw new ApiError('CONFLIT', 'Votre demande est déjà envoyée.', 409);
      if (avant.orientation?.issue !== 'RECOMMANDE') {
        throw new ApiError('ACTION_IMPOSSIBLE', 'Faites d’abord l’orientation (5 questions).', 422);
      }
      journalApi().demandesVerification.push(email);
      const apres: BaseVerification = { ...avant, validation: 'EN_ATTENTE', raison: null };
      verifications.set(email, apres);
      return etatD15(email);
    },


    // ─────────────── L2 : vérification simulée ───────────────

    async lireDossier() {
      await attendre(200);
      return vueDossier(emailSession());
    },
    async envoyerCodeTelephone(telephone, canal) {
      await attendre(300);
      const email = emailSession();
      if (!demandeCodeTelephoneSchema.safeParse({ telephone, canal }).success) throw new ApiError('REQUETE_INVALIDE', MESSAGES.REQUETE_INVALIDE, 400);
      const n = normaliserTelephone(telephone);
      if ('erreur' in n) throw new ApiError('PREFIXE_NON_ACCEPTE', MESSAGES.PREFIXE_NON_ACCEPTE, 422);
      if (n.genre === 'fixe' && canal === 'SMS') {
        throw new ApiError('PREFIXE_NON_ACCEPTE', 'Ce numéro est un fixe : il ne reçoit pas de SMS. Choisissez « Recevoir un appel ».', 422);
      }
      const d = dossierDe(email);
      if (d.items.get('TELEPHONE')?.etat === 'VALIDE') throw new ApiError('DEJA_VALIDE', MESSAGES.DEJA_VALIDE, 409);
      if (d.defi && d.defi.renvoiA > Date.now()) throw new ApiError('TROP_DE_REQUETES', 'Attendez la fin du délai, puis demandez un nouveau code.', 429);
      const renvoiA = Date.now() + reglagesVerif().delaiRenvoiS * 1000;
      if (canal === 'SMS') d.envoisSms += 1;
      d.defi = { id: `defi${journalApi().codesTelephone.length + 1}`, renvoiA, essais: 0, numero: n.e164 };
      journalApi().codesTelephone.push({ canal, fin: n.e164.slice(-4) });
      majItem(email, 'TELEPHONE', { etat: 'EN_COURS', methode: canal === 'APPEL' ? 'OTP_APPEL' : 'OTP_SMS' });
      return {
        challengeId: d.defi.id,
        canal,
        expireA: new Date(Date.now() + 10 * 60_000).toISOString(),
        renvoiPossibleA: new Date(renvoiA).toISOString(),
        appelPossible: d.envoisSms >= 2,
      };
    },
    async confirmerTelephone(challengeId, code) {
      await attendre(300);
      const email = emailSession();
      const d = dossierDe(email);
      if (!codeComplet(code)) throw new ApiError('REQUETE_INVALIDE', 'Le code a 6 chiffres.', 400);
      if (!d.defi || d.defi.id !== challengeId) throw new ApiError('CODE_EXPIRE', MESSAGES.CODE_EXPIRE, 422);
      if (d.defi.essais >= 5) throw new ApiError('TROP_D_ESSAIS', MESSAGES.TROP_D_ESSAIS, 422);
      if (code !== CODE_SMS_SIMULE) {
        d.defi.essais += 1;
        if (d.defi.essais >= 5) throw new ApiError('TROP_D_ESSAIS', MESSAGES.TROP_D_ESSAIS, 422);
        throw new ApiError('CODE_FAUX', `Ce code n’est pas le bon. Il reste ${5 - d.defi.essais} essais.`, 422);
      }
      d.telephoneMasque = masquer(d.defi.numero);
      d.defi = null;
      journalApi().confirmationsTelephone += 1;
      majItem(email, 'TELEPHONE', { etat: 'VALIDE', actionSuivante: 'AUCUNE' });
      return { etat: 'VALIDE' as const, telephoneMasque: d.telephoneMasque };
    },
    async ouvrirSessionIdentite() {
      await attendre(300);
      const email = emailSession();
      const d = dossierDe(email);
      if (d.items.get('IDENTITE')?.etat === 'VALIDE') throw new ApiError('DEJA_VALIDE', MESSAGES.DEJA_VALIDE, 409);
      if (d.sessions >= MAX_SESSIONS_IDENTITE) throw new ApiError('TROP_DE_REQUETES', 'Trois essais sont faits. Choisissez une visio avec l’équipe Koudmen.', 429);
      d.sessions += 1;
      journalApi().sessionsIdentite += 1;
      majItem(email, 'IDENTITE', { etat: 'EN_COURS', methode: 'AUTO_PRESTATAIRE', actionSuivante: 'ATTENDRE', motifComplement: null });
      return {
        url: `https://verification.simulee.koudmen.invalid/session/${d.sessions}`,
        expireA: new Date(Date.now() + 30 * 60_000).toISOString(),
        retour: 'koudmen://verification/retour',
      };
    },
    async demanderVisio(demande) {
      await attendre(300);
      const email = emailSession();
      if (dossierDe(email).items.get('IDENTITE')?.etat === 'VALIDE') throw new ApiError('DEJA_VALIDE', MESSAGES.DEJA_VALIDE, 409);
      journalApi().visios.push(`${demande.creneau}:${demande.raison}`);
      majItem(email, 'IDENTITE', { etat: 'EN_COURS', methode: 'VISIO', actionSuivante: 'ATTENDRE', motifComplement: null });
      return { demandeLe: new Date().toISOString(), creneau: demande.creneau };
    },
    async declarerAdresse(adresse) {
      await attendre(300);
      const email = emailSession();
      if (!demandeAdresseSchema.safeParse(adresse).success) throw new ApiError('REQUETE_INVALIDE', 'Vérifiez l’adresse : numéro et rue, code postal à 5 chiffres, commune.', 400);
      const d = dossierDe(email);
      if (d.items.get('ADRESSE')?.etat === 'VALIDE') throw new ApiError('DEJA_VALIDE', MESSAGES.DEJA_VALIDE, 409);
      journalApi().adresses += 1;
      majItem(email, 'ADRESSE', { etat: 'A_FOURNIR', actionSuivante: 'TELEVERSER_JUSTIFICATIF' });
      return { etat: 'A_FOURNIR' as const, justificatifRequis: true };
    },
    async verifierEntreprise(siret) {
      await attendre(400);
      const email = emailSession();
      const n = normaliserSiret(siret);
      if ('erreur' in n) throw new ApiError('ACTION_IMPOSSIBLE', n.erreur, 422);
      journalApi().entreprises.push(n.siret);
      const cas = n.siret;
      if (cas === SIRET_SIMULES.cesse) {
        majItem(email, 'ENTREPRISE', { etat: 'A_REVOIR', methode: 'AUTO_REGISTRE', actionSuivante: 'ATTENDRE' });
        return {
          etat: 'A_REVOIR' as const,
          actif: false,
          nomConforme: true,
          adresseSiegeConforme: null,
          documentRequis: false,
          message: 'Le registre indique une entreprise fermée. L’équipe relit votre dossier et vous contacte.',
        };
      }
      if (cas === SIRET_SIMULES.nomCache || cas === SIRET_SIMULES.nomDifferent) {
        majItem(email, 'ENTREPRISE', { etat: 'A_FOURNIR', methode: 'AUTO_REGISTRE', actionSuivante: 'TELEVERSER_DOCUMENT_ENTREPRISE' });
        return {
          etat: 'A_FOURNIR' as const,
          actif: true,
          nomConforme: cas === SIRET_SIMULES.nomCache ? null : false,
          adresseSiegeConforme: null,
          documentRequis: true,
          message:
            cas === SIRET_SIMULES.nomCache
              ? 'Le registre cache le nom de cette entreprise. Envoyez un document à votre nom.'
              : 'Le nom du registre n’est pas celui de votre profil. Envoyez un document à votre nom.',
        };
      }
      majItem(email, 'ENTREPRISE', { etat: 'VALIDE', methode: 'AUTO_REGISTRE', actionSuivante: 'AUCUNE' });
      const siegeOk = cas === SIRET_SIMULES.conforme;
      if (siegeOk) majItem(email, 'ADRESSE', { etat: 'VALIDE', methode: 'AUTO_REGISTRE', actionSuivante: 'AUCUNE' });
      return {
        etat: 'VALIDE' as const,
        actif: true,
        nomConforme: true,
        adresseSiegeConforme: siegeOk,
        documentRequis: false,
        message: siegeOk
          ? 'Votre entreprise est active et à votre nom. L’adresse du siège suffit : pas de justificatif.'
          : 'Votre entreprise est active et à votre nom.',
      };
    },
    async envoyerDocument(type, fichier) {
      await attendre(500);
      const email = emailSession();
      const probleme = controlerFichier(fichier);
      if (probleme) throw new ApiError(fichier.taille && fichier.taille > 5 * 1024 * 1024 ? 'FICHIER_TROP_GROS' : 'TYPE_NON_ACCEPTE', probleme, 415);
      journalApi().documents.push({ type, mime: fichier.type, taille: fichier.taille ?? null });
      const item: TypeElement = type === 'JUSTIFICATIF_DOMICILE' || type === 'ATTESTATION_HEBERGEMENT' ? 'ADRESSE' : 'ENTREPRISE';
      majItem(email, item, { etat: 'EN_COURS', methode: 'MANUEL', actionSuivante: 'ATTENDRE', motifComplement: null });
      return { documentId: `doc${journalApi().documents.length}`, etatItem: 'EN_COURS' as const, conservation: '30_JOURS_APRES_DECISION' as const };
    },
    async soumettreDossier() {
      await attendre(350);
      const email = emailSession();
      const vue = vueDossier(email);
      if (!vue.peutSoumettre) {
        if (verificationDe(email).validation === 'EN_ATTENTE') throw new ApiError('CONFLIT', 'Votre demande est déjà envoyée.', 409);
        throw new ApiError('ELEMENTS_MANQUANTS', `Il manque encore : ${vue.manque.join(', ')}.`.slice(0, 300), 422);
      }
      journalApi().soumissions.push(email);
      verifications.set(email, { ...verificationDe(email), validation: 'EN_ATTENTE', raison: null });
    },
    async demanderRecours() {
      await attendre(300);
      emailSession();
      throw new ApiError('ACTION_IMPOSSIBLE', 'Aucun refus à revoir sur votre dossier.', 422);
    },
    simulation: {
      async decisionIdentite(decision) {
        await attendre(250);
        const email = emailSession();
        journalApi().decisionsIdentite.push(decision);
        if (decision === 'APPROUVE') majItem(email, 'IDENTITE', { etat: 'VALIDE', methode: 'AUTO_PRESTATAIRE', actionSuivante: 'AUCUNE' });
        else if (decision === 'A_REPRENDRE') {
          majItem(email, 'IDENTITE', { etat: 'A_FOURNIR', methode: 'AUTO_PRESTATAIRE', actionSuivante: 'VERIFIER_IDENTITE', motifComplement: 'REPRENDRE_PHOTO' });
        }
        // Refus du prestataire ou nom différent : jamais REFUSE direct, une personne relit (§ 6.2).
        else majItem(email, 'IDENTITE', { etat: 'A_REVOIR', methode: 'AUTO_PRESTATAIRE', actionSuivante: 'ATTENDRE' });
      },
    },

    async listerVisites() {
      await attendre();
      exigerSession();
      return [...visites].sort((x, y) => x.debut.localeCompare(y.debut));
    },
    async lireVisite(id): Promise<ReponseVisite> {
      await attendre(160);
      exigerSession();
      const v = trouver(id);
      return { ...v, brouillonKaye: v.kayePublie ? null : (brouillons.get(id) ?? null) };
    },

    async checkIn(visiteId, { qr, codeDomicile, position }) {
      await attendre(450);
      exigerSession();
      const v = trouver(visiteId);
      journalApi().checkIns.push({ visiteId, qr: !!qr, code: !!codeDomicile, position: !!position, simulee: position?.simulee === true });
      if (!v.actions.checkIn) throw new ApiError('CONFLIT', 'L’arrivée est déjà enregistrée, ou la visite n’est pas ouverte.');
      // L10 : jeton faux ou révoqué → l'événement est refusé (motif INVALIDE).
      if (qr && /revoque/i.test(qr)) {
        throw new ApiError('INVALIDE', 'Cette carte domicile n’est plus valable : la famille en a imprimé une nouvelle. Entrez le code écrit sous le QR.');
      }
      const codeOk = codeDomicile ? codeDomicile.trim().toUpperCase() === CODE_DOMICILE_SIMULE : undefined;
      if (!qr && !position && codeOk === false) throw new ApiError('INVALIDE', 'Ce code ne correspond pas au domicile.');

      // L10 : distance au domicile (≤ 150 m, précision prise en compte) et refus d'une position simulée.
      const domicile = domicileDe(v);
      let positionOk = false;
      let raisonPosition: string | null = null;
      if (position) {
        if (position.simulee) raisonPosition = 'Le téléphone signale une position simulée. La preuve est à vérifier.';
        else if (domicile) {
          const d = distanceMetres(position, domicile);
          positionOk = d <= DISTANCE_ARRIVEE_M + Math.min(position.precisionMetres ?? 0, 100);
          raisonPosition = positionOk ? null : `Position à environ ${Math.round(d / 10) * 10} m du domicile. La preuve est à vérifier.`;
        }
      }
      const facteurs: FacteurPreuve[] = [...(positionOk ? (['GPS'] as const) : []), ...(qr || codeOk ? (['CODE_DOMICILE'] as const) : [])];
      const controle: ControleCheckIn | undefined = qr
        ? position && !positionOk
          ? { statut: 'A_VERIFIER', raison: raisonPosition }
          : { statut: 'VALIDE', raison: positionOk ? 'Carte domicile reconnue et position à moins de 150 m.' : 'Carte domicile reconnue.' }
        : undefined;
      const nv = remplacer({
        ...v,
        statut: controle?.statut === 'A_VERIFIER' ? 'A_VERIFIER' : facteurs.length >= SEUIL_PREUVE ? 'VALIDEE' : 'EN_COURS',
        preuve: { ...v.preuve, score: facteurs.length, facteursValides: facteurs, checkInA: new Date().toISOString() },
        actions: { checkIn: false, checkOut: true, kaye: true },
      });
      // L6 : le check-in arrête le trajet. Aucune position n'est gardée.
      trajets.delete(visiteId);
      const r: ResultatEvenement = {
        ...resultat('CHECK_IN', nv),
        ...(controle ? { controle } : {}),
        preuves: {
          ...(codeDomicile && !qr ? { code: { valide: !!codeOk, message: codeOk ? null : 'Ce code ne correspond pas au domicile.' } } : {}),
          ...(position ? { position: { valide: positionOk, message: positionOk ? 'Position lue à moins de 150 m du domicile.' : raisonPosition } } : {}),
        },
      };
      return r;
    },
    async checkOut(visiteId) {
      await attendre(300);
      exigerSession();
      const v = trouver(visiteId);
      if (!v.actions.checkOut) throw new ApiError('CONFLIT', 'Le départ est déjà enregistré.');
      const nv = remplacer({ ...v, preuve: { ...v.preuve, checkOutA: new Date().toISOString() }, actions: { ...v.actions, checkOut: false } });
      return resultat('CHECK_OUT', nv);
    },
    async enregistrerBrouillonKaye(visiteId, brouillon) {
      await attendre(250);
      exigerSession();
      brouillons.set(visiteId, brouillon);
      return resultat('KAYE_BROUILLON', trouver(visiteId));
    },
    async publierKaye(visiteId, kaye) {
      await attendre(450);
      exigerSession();
      const v = trouver(visiteId);
      if (!v.actions.kaye) throw new ApiError('CONFLIT', 'Ce Kayé est déjà publié, ou l’arrivée n’est pas enregistrée.');
      if (kaye.aSurveiller && !kaye.noteSurveillance) throw new ApiError('INVALIDE', 'Dites ce qu’il faut surveiller.');
      brouillons.delete(visiteId);
      return resultat('KAYE_PUBLICATION', remplacer({ ...v, kayePublie: true, actions: { ...v.actions, kaye: false } }));
    },
    async sos(visiteId) {
      await attendre(300);
      exigerSession();
      return resultat('SOS', visiteId ? trouver(visiteId) : undefined, {
        consigne: 'Si une personne est en danger, appelez le 15 (SAMU) ou le 112 maintenant. L’équipe Koudmen est prévenue.',
      });
    },

    async demarrerTrajet(visiteId) {
      await attendre(300);
      exigerSession();
      const v = trouver(visiteId);
      if (v.preuve.checkInA) throw new ApiError('CONFLIT', 'Votre arrivée est déjà enregistrée.', 409);
      const fin = Date.now() + DUREE_MAX_TRAJET_MIN * 60_000;
      trajets.set(visiteId, fin);
      journalApi().trajets.push({ visiteId, action: 'DEMARRER' });
      return { etat: 'EN_COURS', expireA: new Date(fin).toISOString(), domicile: domicileDe(v) };
    },
    async arreterTrajet(visiteId) {
      await attendre(150);
      exigerSession();
      trajets.delete(visiteId);
      journalApi().trajets.push({ visiteId, action: 'ARRETER' });
      return { etat: 'ARRETE', expireA: null, domicile: null };
    },
    async envoyerPosition(visiteId, p) {
      await attendre(120);
      exigerSession();
      const fin = trajets.get(visiteId);
      if (!fin || fin < Date.now()) {
        trajets.delete(visiteId);
        throw new ApiError('CONFLIT', 'Le partage du trajet est terminé.', 409);
      }
      journalApi().positions.push({ visiteId, latitude: p.latitude, longitude: p.longitude, precisionMetres: p.precisionMetres, simulee: p.simulee === true });
    },

    async listerPropositions() {
      await attendre();
      exigerSession();
      return propositions;
    },
    async accepterProposition(id) {
      await attendre(400);
      exigerSession();
      const p = propositions.find((x) => x.id === id);
      if (!p) throw new ApiError('CONFLIT', 'Cette proposition n’est plus disponible.', 409);
      propositions = propositions.filter((x) => x.id !== id);
      return { statut: 'ACCEPTEE', missionId: `mis_${id}`, visitesCreees: p.visitesPrevues };
    },
    async refuserProposition(id) {
      await attendre(300);
      exigerSession();
      if (!propositions.some((x) => x.id === id)) throw new ApiError('CONFLIT', 'Cette proposition n’est plus disponible.', 409);
      propositions = propositions.filter((x) => x.id !== id);
      return { statut: 'REFUSEE', sansPenalite: true };
    },

    // Lot N1 : aucun serveur ; l'appareil est « enregistré » en mémoire.
    async enregistrerAppareil() {
      exigerSession();
      return { id: 'appareil-simule' };
    },
    async retirerAppareil() {
      return undefined;
    },
  };
}
