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
 * Implémentation SIMULÉE (démo hors ligne, `EXPO_PUBLIC_API_MODE=simule`).
 * Mêmes formes que l'API v1 (contrats Zod). Données en mémoire, perdues au redémarrage.
 */

export const EMAIL_DEMO = 'accompagnant@demo.koudmen.test';
export const MOT_DE_PASSE_DEMO = 'koudmen';
export const CODE_DOMICILE_DEMO = 'KDM482';

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
  email: EMAIL_DEMO,
  demo: true,
  bacASable: false,
};

function visite(id: string, debut: string, finMin: number, aine: Partial<Visite['aine']>, consignes: string, checkIn: boolean): Visite {
  return {
    id,
    debut,
    fin: new Date(new Date(debut).getTime() + finMin * 60_000).toISOString(),
    statut: 'PREVUE',
    aine: {
      prenom: 'Léonie',
      initialeNom: 'B.',
      commune: 'SAINTE_LUCE',
      communeLibelle: 'Sainte-Luce',
      adresseApproximative: 'Quartier Désert',
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
      { prenom: 'Marceline', initialeNom: 'J.', adresseApproximative: 'Trois-Rivières' },
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
      if (!email.includes('@') || motDePasse !== MOT_DE_PASSE_DEMO) {
        throw new ApiError('IDENTIFIANTS_INVALIDES', MESSAGES.IDENTIFIANTS_INVALIDES, 401);
      }
      session = MOI;
      return session;
    },
    async connecterDemo() {
      await attendre();
      session = MOI;
      return session;
    },
    async restaurer() {
      return session;
    },
    async moi() {
      exigerSession();
      return MOI;
    },
    async deconnecter() {
      await attendre(120);
      session = null;
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

    async checkIn(visiteId, { codeDomicile, position }) {
      await attendre(450);
      exigerSession();
      const v = trouver(visiteId);
      if (!v.actions.checkIn) throw new ApiError('CONFLIT', 'L’arrivée est déjà enregistrée, ou la visite n’est pas ouverte.');
      const codeOk = codeDomicile ? codeDomicile.trim().toUpperCase() === CODE_DOMICILE_DEMO : undefined;
      if (!position && codeOk === false) throw new ApiError('INVALIDE', 'Ce code ne correspond pas au domicile.');
      const facteurs: FacteurPreuve[] = [...(position ? (['GPS'] as const) : []), ...(codeOk ? (['CODE_DOMICILE'] as const) : [])];
      const maintenant = new Date().toISOString();
      const nv = remplacer({
        ...v,
        statut: facteurs.length >= SEUIL_PREUVE ? 'VALIDEE' : 'EN_COURS',
        preuve: { ...v.preuve, score: facteurs.length, facteursValides: facteurs, checkInA: maintenant },
        actions: { checkIn: false, checkOut: true, kaye: true },
      });
      return resultat('CHECK_IN', nv, {
        preuves: {
          ...(codeDomicile ? { code: { valide: !!codeOk, message: codeOk ? null : 'Ce code ne correspond pas au domicile.' } } : {}),
          ...(position ? { position: { valide: true, message: 'Position lue à environ 20 m du domicile.' } } : {}),
        },
      });
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
  };
}
