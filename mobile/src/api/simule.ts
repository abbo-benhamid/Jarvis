import { demandeInscriptionSchema, type ControleCheckIn } from '@/contracts';
import {
  ageEnAnnees,
  AGE_MIN_ACCOMPAGNANT,
  DISTANCE_ARRIVEE_M,
  DUREE_MAX_TRAJET_MIN,
  PREFIXE_QR_SIGNE,
  type DomicileTrajet,
} from './l1';
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
};

function journalApi(): JournalApiSimulee {
  const g = globalThis as { __KOUDMEN_API_JOURNAL__?: JournalApiSimulee };
  g.__KOUDMEN_API_JOURNAL__ ??= { inscriptions: [], motsDePasseOublies: [], trajets: [], positions: [], checkIns: [] };
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
};

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
