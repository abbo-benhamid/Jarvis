/**
 * Gestionnaire du trajet partagé (L1, L6). Module PUR : aucun import React Native (testable sans appareil).
 *
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> inactif
 *   inactif --> demarrage : demarrer() (après l'accord)
 *   demarrage --> en_cours : DEMARRER accepté + suivi lancé
 *   demarrage --> inactif : refus (réseau, permission)
 *   en_cours --> inactif : arrêt manuel · check-in · 60 min · < 150 m · arrière-plan · 409 serveur
 * ```
 *
 * Règles (arbitrage L1 + décisions après la critique juridique) :
 * - UNE position au plus toutes les 30 s ; jamais de file hors ligne : seule la DERNIÈRE lecture compte.
 *   Sans réseau, l'envoi échoue et l'app attend la lecture suivante (rien n'est gardé).
 * - Position ENVOYÉE arrondie à ~100 m (3 décimales) ; précision annoncée ≥ 100 m.
 * - La lecture précise reste en MÉMOIRE (carte de l'accompagnant, arrêt à 150 m). Effacée à l'arrêt.
 * - Arrêt automatique à 60 min, et à moins de 150 m d'un domicile PRÉCIS (pas d'un centre de commune).
 */
import {
  DECIMALES_POSITION_TRAJET,
  DISTANCE_ARRIVEE_M,
  DUREE_MAX_TRAJET_MIN,
  type DomicileTrajet,
} from '../api/l1';
import { arrondir, distanceMetres } from '../lib/geo';
import type { PositionTrajet } from '../api/client';
import { ApiError, type EtatTrajetServeur } from '../api/types';
import type { LectureTrajet } from '../native/types';

export type RaisonFin = 'manuel' | 'arrivee' | 'check_in' | 'duree' | 'arriere_plan' | 'serveur' | 'deconnexion' | 'session';

export const MESSAGES_FIN: Record<RaisonFin, string> = {
  manuel: 'Partage arrêté. Votre position n’est plus envoyée.',
  arrivee: 'Vous êtes presque arrivé. Le partage s’arrête tout seul.',
  check_in: 'Arrivée enregistrée. Le partage du trajet est arrêté.',
  duree: 'Le partage s’arrête après 60 minutes. Vous pouvez le relancer.',
  arriere_plan: 'Le partage s’arrête quand Koudmen n’est plus à l’écran. Vous pouvez le relancer.',
  serveur: 'Le partage du trajet est terminé.',
  deconnexion: 'Partage arrêté.',
  session: 'Votre connexion a expiré. Le partage est arrêté.',
};

export type EtatTrajet =
  | { statut: 'inactif'; fin: { raison: RaisonFin; message: string; visiteId: string } | null }
  | { statut: 'demarrage'; visiteId: string; prenom: string }
  | {
      statut: 'en_cours';
      visiteId: string;
      prenom: string;
      /** Fin automatique (ms). */
      expireA: number;
      domicile: DomicileTrajet | null;
      /** Dernière lecture PRÉCISE, en mémoire seulement (carte de l'accompagnant). */
      derniere: { latitude: number; longitude: number; precisionMetres: number } | null;
      /** Distance au domicile (m), si les deux sont connus. */
      distanceMetres: number | null;
      /** Heure du dernier envoi réussi (ms). */
      dernierEnvoiA: number | null;
      /** `hors_ligne` : le dernier envoi n'est pas parti (réseau). La lecture suivante sera envoyée. */
      reseau: 'ok' | 'hors_ligne';
      avis: string | null;
    };

export type ApiTrajet = {
  demarrerTrajet(visiteId: string): Promise<EtatTrajetServeur>;
  arreterTrajet(visiteId: string): Promise<EtatTrajetServeur>;
  envoyerPosition(visiteId: string, p: PositionTrajet): Promise<void>;
};

export type Horloge = {
  maintenant(): number;
  programmer(fn: () => void, ms: number): () => void;
};

export const horlogeSysteme: Horloge = {
  maintenant: () => Date.now(),
  programmer: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};

export type OptionsTrajet = {
  api: ApiTrajet;
  suivre: (surLecture: (l: LectureTrajet) => void, surErreur: (m: string) => void) => Promise<{ arreter(): void }>;
  ecartEnvoiMs: () => number;
  horloge?: Horloge;
};

/** Position envoyée au serveur : arrondie à ~100 m, précision annoncée ≥ 100 m. */
export function positionAEnvoyer(l: LectureTrajet): PositionTrajet {
  return {
    latitude: arrondir(l.latitude, DECIMALES_POSITION_TRAJET),
    longitude: arrondir(l.longitude, DECIMALES_POSITION_TRAJET),
    precisionMetres: Math.min(100_000, Math.max(100, Math.round(l.precisionMetres))),
    survenuA: new Date(l.lueA).toISOString(),
    simulee: l.simulee,
  };
}

export function creerGestionnaireTrajet(o: OptionsTrajet) {
  const h = o.horloge ?? horlogeSysteme;
  let etat: EtatTrajet = { statut: 'inactif', fin: null };
  const ecouteurs = new Set<(e: EtatTrajet) => void>();
  /** Numéro du trajet : une réponse d'un trajet fini n'agit plus. */
  let numero = 0;
  let abonnement: { arreter(): void } | null = null;
  let annulerFin: (() => void) | null = null;
  let annulerEnvoi: (() => void) | null = null;
  let envoiEnVol = false;
  /** Dernière lecture pas encore envoyée (seule la dernière compte). */
  let aEnvoyer: LectureTrajet | null = null;
  let dernierEssaiA: number | null = null;

  const publier = (e: EtatTrajet) => {
    etat = e;
    for (const cb of ecouteurs) cb(etat);
  };
  const majEnCours = (patch: Partial<Extract<EtatTrajet, { statut: 'en_cours' }>>) => {
    if (etat.statut === 'en_cours') publier({ ...etat, ...patch });
  };

  function nettoyer() {
    abonnement?.arreter();
    abonnement = null;
    annulerFin?.();
    annulerFin = null;
    annulerEnvoi?.();
    annulerEnvoi = null;
    aEnvoyer = null;
    dernierEssaiA = null;
    envoiEnVol = false;
  }

  /** Arrête le partage. `prevenirServeur` : envoie ARRETER (sauf si le serveur l'a déjà fait). */
  function terminer(raison: RaisonFin, prevenirServeur = raison !== 'check_in' && raison !== 'serveur' && raison !== 'session') {
    if (etat.statut === 'inactif') return;
    const visiteId = etat.visiteId;
    numero += 1;
    nettoyer();
    publier({ statut: 'inactif', fin: { raison, message: MESSAGES_FIN[raison], visiteId } });
    if (prevenirServeur) void o.api.arreterTrajet(visiteId).catch(() => undefined);
  }

  async function envoyer(n: number) {
    if (etat.statut !== 'en_cours' || n !== numero || envoiEnVol || !aEnvoyer) return;
    const ecart = o.ecartEnvoiMs();
    const t = h.maintenant();
    if (dernierEssaiA !== null && t - dernierEssaiA < ecart) {
      // Trop tôt : un seul envoi programmé ; il prendra la DERNIÈRE lecture à ce moment-là.
      if (!annulerEnvoi) {
        annulerEnvoi = h.programmer(() => {
          annulerEnvoi = null;
          void envoyer(n);
        }, ecart - (t - dernierEssaiA));
      }
      return;
    }
    const lecture = aEnvoyer;
    aEnvoyer = null;
    dernierEssaiA = t;
    envoiEnVol = true;
    const visiteId = etat.visiteId;
    try {
      await o.api.envoyerPosition(visiteId, positionAEnvoyer(lecture));
      if (n !== numero) return;
      majEnCours({ dernierEnvoiA: h.maintenant(), reseau: 'ok', avis: null });
    } catch (e) {
      if (n !== numero) return;
      const code = e instanceof ApiError ? e.code : 'RESEAU';
      if (code === 'CONFLIT') return terminer('serveur');
      if (code === 'JETON_INVALIDE' || code === 'JETON_REUTILISE' || code === 'ACCES_REFUSE') return terminer('session');
      // Réseau, serveur occupé, 429 : la position est PERDUE (pas de file). La suivante partira.
      majEnCours({ reseau: code === 'TROP_DE_REQUETES' ? 'ok' : 'hors_ligne' });
    } finally {
      if (n === numero) envoiEnVol = false;
    }
    // Une lecture est arrivée pendant l'envoi : elle part au prochain créneau.
    if (n === numero && aEnvoyer) void envoyer(n);
  }

  function surLecture(n: number, l: LectureTrajet) {
    if (etat.statut !== 'en_cours' || n !== numero) return;
    const d = etat.domicile ? distanceMetres(l, etat.domicile) : null;
    majEnCours({ derniere: { latitude: l.latitude, longitude: l.longitude, precisionMetres: l.precisionMetres }, distanceMetres: d });
    // Arrivée : à moins de 150 m d'un domicile PRÉCIS (un centre de commune peut être à 1 km).
    if (d !== null && etat.domicile && !etat.domicile.approximatif && d <= DISTANCE_ARRIVEE_M) {
      terminer('arrivee');
      return;
    }
    aEnvoyer = l;
    void envoyer(n);
  }

  return {
    etat: () => etat,
    abonner(cb: (e: EtatTrajet) => void) {
      ecouteurs.add(cb);
      return () => {
        ecouteurs.delete(cb);
      };
    },

    /**
     * Démarre le partage (après l'accord affiché). DEMARRER d'abord, puis le suivi.
     * Lève une `ApiError` affichable (réseau, permission refusée, visite déjà commencée).
     */
    async demarrer(visiteId: string, prenom: string, domicileRepli: DomicileTrajet | null) {
      if (etat.statut !== 'inactif') {
        if (etat.visiteId === visiteId) return;
        terminer('manuel');
      }
      const n = ++numero;
      publier({ statut: 'demarrage', visiteId, prenom });
      let reponse: EtatTrajetServeur;
      try {
        reponse = await o.api.demarrerTrajet(visiteId);
      } catch (e) {
        if (n === numero) publier({ statut: 'inactif', fin: null });
        throw e;
      }
      if (n !== numero) return;
      const max = h.maintenant() + DUREE_MAX_TRAJET_MIN * 60_000;
      const serveur = reponse.expireA ? Date.parse(reponse.expireA) : NaN;
      const expireA = Number.isFinite(serveur) ? Math.min(serveur, max) : max;
      publier({
        statut: 'en_cours',
        visiteId,
        prenom,
        expireA,
        domicile: reponse.domicile ?? domicileRepli,
        derniere: null,
        distanceMetres: null,
        dernierEnvoiA: null,
        reseau: 'ok',
        avis: null,
      });
      annulerFin = h.programmer(() => {
        if (n === numero) terminer('duree');
      }, Math.max(0, expireA - h.maintenant()));
      try {
        const ab = await o.suivre(
          (l) => surLecture(n, l),
          (m) => {
            if (n === numero) majEnCours({ avis: m });
          },
        );
        if (n !== numero) {
          ab.arreter();
          return;
        }
        abonnement = ab;
      } catch (e) {
        if (n === numero) {
          numero += 1;
          nettoyer();
          publier({ statut: 'inactif', fin: null });
          void o.api.arreterTrajet(visiteId).catch(() => undefined);
        }
        throw e;
      }
    },

    arreter(raison: RaisonFin = 'manuel') {
      terminer(raison);
    },

    /** Oublie le message de fin (après lecture). */
    oublierFin() {
      if (etat.statut === 'inactif' && etat.fin) publier({ statut: 'inactif', fin: null });
    },
  };
}

export type GestionnaireTrajet = ReturnType<typeof creerGestionnaireTrajet>;
