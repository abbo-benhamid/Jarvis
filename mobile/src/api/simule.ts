import type { KoudmenApi } from './client';
import {
  ApiError,
  type Accompagnant,
  type KayeBrouillon,
  type Preuve,
  type PreuveType,
  type Session,
  type Visite,
} from './types';

/**
 * Implémentation SIMULÉE (lot M1). Données en mémoire, perdues au redémarrage.
 * Code de connexion de démonstration : 123456. Code du domicile : 4821.
 */

export const CODE_DEMO = '123456';
export const CODE_DOMICILE_DEMO = '4821';

const attendre = (ms = 280) => new Promise<void>((r) => setTimeout(r, ms));

/** Date du jour + décalage en jours, à l'heure donnée (heure locale). */
function a(jours: number, h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const JOSIANE: Accompagnant = {
  id: 'acc_josiane',
  prenom: 'Josiane',
  nom: 'Mathurin',
  commune: 'Sainte-Luce',
  tarifHoraireCentimes: 1800,
  statut: 'AUTO_ENTREPRENEUR',
};

function preuvesVides(): Preuve[] {
  return [{ type: 'POSITION' }, { type: 'CODE' }, { type: 'CONFIRMATION_AINE' }];
}

function donneesInitiales(): Visite[] {
  return [
    {
      id: 'vis_leonie_j0',
      aine: {
        prenom: 'Léonie',
        nom: 'Bellance',
        quartier: 'Quartier Désert',
        commune: 'Sainte-Luce',
        gouts: ['Dominos', 'Son jardin', 'Parle créole'],
      },
      debut: a(0, 10),
      fin: a(0, 12),
      statut: 'EN_COURS',
      consigne: 'Marché de Rivière-Pilote, puis le courrier de la CGSS.',
      acces: 'Code sur la porte de la cuisine',
      trajetMin: 4,
      preuves: [{ type: 'POSITION', obtenueA: a(0, 9, 58), distanceArrondieM: 20 }, { type: 'CODE' }, { type: 'CONFIRMATION_AINE' }],
      kayeEnvoye: false,
    },
    {
      id: 'vis_desire_j0',
      aine: {
        prenom: 'Alphonse',
        nom: 'Désiré',
        quartier: 'Bourg',
        commune: 'Rivière-Pilote',
        gouts: ['Radio', 'Football', 'Ses petits-enfants'],
      },
      debut: a(0, 15),
      fin: a(0, 16, 30),
      statut: 'A_VENIR',
      consigne: 'Promenade courte et lecture du journal.',
      acces: 'Code dans la boîte aux lettres',
      trajetMin: 12,
      preuves: preuvesVides(),
      kayeEnvoye: false,
    },
    {
      id: 'vis_leonie_j2',
      aine: {
        prenom: 'Léonie',
        nom: 'Bellance',
        quartier: 'Quartier Désert',
        commune: 'Sainte-Luce',
        gouts: ['Dominos', 'Son jardin', 'Parle créole'],
      },
      debut: a(2, 9, 30),
      fin: a(2, 11),
      statut: 'A_VENIR',
      consigne: 'Rendez-vous chez le pharmacien du bourg.',
      acces: 'Code sur la porte de la cuisine',
      trajetMin: 4,
      preuves: preuvesVides(),
      kayeEnvoye: false,
    },
    {
      id: 'vis_marceline_j3',
      aine: {
        prenom: 'Marceline',
        nom: 'Joseph-Angélique',
        quartier: 'Trois-Rivières',
        commune: 'Sainte-Luce',
        gouts: ['Cuisine', 'Chants de messe'],
      },
      debut: a(3, 14),
      fin: a(3, 16),
      statut: 'A_VENIR',
      consigne: 'Courses au marché, puis un café ensemble.',
      acces: 'Code sous le pot de fleurs',
      trajetMin: 9,
      preuves: preuvesVides(),
      kayeEnvoye: false,
    },
  ];
}

export function creerApiSimulee(): KoudmenApi {
  let session: Session | null = null;
  let visites = donneesInitiales();
  const brouillons = new Map<string, KayeBrouillon>();

  const exigerSession = () => {
    if (!session) throw new ApiError('NON_CONNECTE', 'Vous n’êtes pas connecté.');
  };

  const trouver = (id: string): Visite => {
    const v = visites.find((x) => x.id === id);
    if (!v) throw new ApiError('INTROUVABLE', 'Cette visite n’existe pas.');
    return v;
  };

  const remplacer = (v: Visite) => {
    visites = visites.map((x) => (x.id === v.id ? v : x));
    return v;
  };

  return {
    async demanderCode(telephone) {
      await attendre();
      if (telephone.replace(/\D/g, '').length < 9) {
        throw new ApiError('INVALIDE', 'Ce numéro est trop court.');
      }
    },

    async connecter(_telephone, code) {
      await attendre();
      if (code !== CODE_DEMO) throw new ApiError('CODE_INVALIDE', 'Ce code ne correspond pas.');
      session = { accompagnant: JOSIANE, jeton: 'jeton-simule' };
      return session;
    },

    async deconnecter() {
      await attendre(120);
      session = null;
      visites = donneesInitiales();
      brouillons.clear();
    },

    async listerVisites() {
      await attendre();
      exigerSession();
      return [...visites].sort((x, y) => x.debut.localeCompare(y.debut));
    },

    async lireVisite(id) {
      await attendre(160);
      exigerSession();
      return trouver(id);
    },

    async ajouterPreuve(visiteId, type: PreuveType, donnees) {
      await attendre(type === 'CONFIRMATION_AINE' ? 700 : 400);
      exigerSession();
      const v = trouver(visiteId);
      if (type === 'CODE' && donnees?.code !== undefined && donnees.code !== CODE_DOMICILE_DEMO) {
        throw new ApiError('INVALIDE', 'Ce code ne correspond pas au domicile.');
      }
      const maintenant = new Date().toISOString();
      const preuves = v.preuves.map((p) =>
        p.type === type
          ? { ...p, obtenueA: maintenant, ...(type === 'POSITION' ? { distanceArrondieM: 20 } : {}) }
          : p,
      );
      return remplacer({ ...v, preuves, statut: v.statut === 'A_VENIR' ? 'EN_COURS' : v.statut });
    },

    async lireBrouillonKaye(visiteId) {
      await attendre(120);
      exigerSession();
      return (
        brouillons.get(visiteId) ?? {
          visiteId,
          humeur: null,
          appetit: null,
          note: '',
          aSurveiller: false,
          aSurveillerDetail: '',
        }
      );
    },

    async enregistrerKaye(brouillon, envoyer) {
      await attendre(450);
      exigerSession();
      if (envoyer && (!brouillon.humeur || !brouillon.appetit)) {
        throw new ApiError('INVALIDE', 'Choisissez l’humeur et l’appétit.');
      }
      if (envoyer && brouillon.aSurveiller && brouillon.aSurveillerDetail.trim().length < 3) {
        throw new ApiError('INVALIDE', 'Décrivez ce qu’il faut surveiller.');
      }
      brouillons.set(brouillon.visiteId, brouillon);
      if (envoyer) {
        const v = trouver(brouillon.visiteId);
        remplacer({ ...v, kayeEnvoye: true, statut: 'TERMINEE' });
      }
    },
  };
}
