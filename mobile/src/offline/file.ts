import type { BrouillonKaye, Evenement, ResultatEvenement, TypeEvenement } from '../contracts';
import { MESSAGES } from '../api/messages';
import { ApiError, type CodeErreurApp } from '../api/types';
import { planifierParDefaut, type LigneStockee, type Planifier, type StockageHorsLigne } from './types';

/**
 * File d'événements persistante (lot M3, ADR 0008 ; api-v1 § 9.2).
 *
 * Règles :
 * 1. Chaque action (check-in, check-out, Kayé, SOS) entre d'abord dans la file (stockage), PUIS part.
 * 2. Envoi UN PAR UN, dans l'ordre d'arrivée. Exception : un SOS passe devant (sécurité d'abord).
 * 3. Renvoi avec le MÊME `clientEventId` : le serveur répond DOUBLON avec le résultat d'origine.
 * 4. Erreur réseau (ou 5xx, 429, réponse illisible) : la file S'ARRÊTE, puis réessaie
 *    avec une attente progressive (2 s, 4 s, 8 s… 5 min au plus). L'ordre est gardé.
 * 5. Erreur métier définitive (REFUSE, 400, 404…) : l'événement n'est PLUS envoyé. Il devient un « refus »
 *    affichable (motif + message, SANS le contenu du Kayé), puis la file continue.
 * 6. Session perdue : la file s'arrête et garde tout. Elle repart après la reconnexion.
 * 7. Déconnexion : `vider()` (et `toutEffacer()` du stockage par l'appelant).
 */

/** Envoie UN événement (POST /evenements). Lève une `ApiError` si la requête échoue. */
export type Transport = (evenement: Evenement) => Promise<ResultatEvenement>;

/** `__DEV__` existe dans Metro, pas sous Node (tests). */
const __DEV_SAFE__ = typeof __DEV__ !== 'undefined' && __DEV__;

export type Refus = {
  id: string;
  type: TypeEvenement;
  visiteId: string | null;
  code: CodeErreurApp;
  message: string;
};

export type EtatFile = {
  /** Événements pas encore acceptés par le serveur. */
  enAttente: number;
  /** Événements refusés (définitif), à montrer une fois. */
  refus: Refus[];
  envoiEnCours: boolean;
  /** Pourquoi la file est arrêtée : réseau (nouvel essai programmé) ou session (attente de reconnexion). */
  blocage: 'reseau' | 'session' | null;
  /** Heure (ms) du prochain essai programmé. */
  prochainEssaiA: number | null;
};

export type OptionsFile = {
  stockage: StockageHorsLigne;
  transport: Transport;
  maintenant?: () => number;
  /** Nombre dans [0, 1) pour l'aléa de l'attente progressive. */
  alea?: () => number;
  planifier?: Planifier;
};

export interface FileEvenements {
  /**
   * Garde l'événement dans la file, puis essaie de l'envoyer tout de suite.
   * - Envoyé : renvoie le résultat du serveur.
   * - Refus définitif : lève `ApiError(motif, message)`.
   * - Pas de réseau : lève `ApiError('EN_ATTENTE')`. L'événement RESTE dans la file et part plus tard.
   */
  soumettre(evenement: Evenement): Promise<ResultatEvenement>;
  /** Envoie ce qui attend. `forcer` ignore l'attente progressive (retour du réseau, réouverture, nouvelle action). */
  synchroniser(options?: { forcer?: boolean }): Promise<void>;
  etat(): EtatFile;
  abonner(cb: (etat: EtatFile) => void): () => void;
  /** Dernier Kayé (brouillon ou publication) en attente pour cette visite, pour le remettre dans le formulaire. */
  kayeEnAttente(visiteId: string): Promise<BrouillonKaye | null>;
  /** Efface un refus (ou tous) après lecture. */
  oublierRefus(id?: string): Promise<void>;
  /** Vide la mémoire de la file et annule les essais programmés (déconnexion). Le stockage est vidé par l'appelant. */
  vider(): void;
}

/** Attente progressive : 2 s × 2^(n−1), 5 min au plus, + 0 à 20 % d'aléa (évite que tous les téléphones repartent ensemble). */
export const ATTENTE_BASE_MS = 2_000;
export const ATTENTE_MAX_MS = 5 * 60_000;
export function delaiAttente(echecs: number, alea: number): number {
  const base = Math.min(ATTENTE_MAX_MS, ATTENTE_BASE_MS * 2 ** Math.max(0, echecs - 1));
  return Math.round(base * (1 + 0.2 * alea));
}

const TRANSITOIRES = new Set<CodeErreurApp>(['RESEAU', 'ERREUR_INTERNE', 'TROP_DE_REQUETES', 'REPONSE_INVALIDE']);
const SESSION = new Set<CodeErreurApp>(['NON_AUTHENTIFIE', 'JETON_INVALIDE', 'JETON_REUTILISE', 'ACCES_REFUSE', 'CODE_INVALIDE']);

export type Genre = 'reseau' | 'session' | 'definitif';

/** Classe une erreur d'envoi. Une erreur inconnue (pas une `ApiError`) compte comme une erreur réseau. */
export function classerErreur(e: unknown): Genre {
  if (!(e instanceof ApiError)) return 'reseau';
  if (TRANSITOIRES.has(e.code)) return 'reseau';
  if (SESSION.has(e.code)) return 'session';
  return 'definitif';
}

/** Message affiché quand l'action reste dans la file (pas de réseau). */
export function messageAttente(type: TypeEvenement): string {
  switch (type) {
    case 'CHECK_IN':
      return 'Pas de réseau. Votre arrivée est gardée sur ce téléphone. Elle part toute seule au retour du réseau.';
    case 'CHECK_OUT':
      return 'Pas de réseau. Votre départ est gardé sur ce téléphone. Il part tout seul au retour du réseau.';
    case 'KAYE_BROUILLON':
      return 'Pas de réseau. Le brouillon est gardé sur ce téléphone. Il part tout seul au retour du réseau.';
    case 'KAYE_PUBLICATION':
      return 'Pas de réseau. Le Kayé est gardé sur ce téléphone. Il part tout seul au retour du réseau.';
    case 'SOS':
      // L'écran SOS ajoute « En cas de danger, appelez le 15 ou le 112. » et montre les deux boutons d'appel.
      return 'Pas de réseau : l’alerte n’est pas partie. Elle part au retour du réseau.';
  }
}

const erreurDeconnecte = () => new ApiError('NON_AUTHENTIFIE', 'Vous êtes déconnecté. Les envois en attente sont effacés de ce téléphone.');

type Ligne = {
  id: string;
  seq: number;
  statut: 'EN_ATTENTE' | 'REFUSE';
  tentatives: number;
  evenement: Evenement | null;
  refus: Refus | null;
};

type Attente = { resolve: (r: ResultatEvenement) => void; reject: (e: unknown) => void };

type Issue = { ok: ResultatEvenement } | { genre: Genre; erreur: ApiError };

function visiteDe(e: Evenement): string | null {
  return e.visiteId ?? null;
}

/** Lit la réponse du serveur pour UN événement (api-v1 § 9.2, règle 1). */
export function interpreterResultat(r: ResultatEvenement): Issue {
  if (r.statut === 'ACCEPTE') return { ok: r };
  if (r.statut === 'DOUBLON') {
    if (r.statutOrigine === 'EN_COURS') {
      // Un envoi précédent est encore traité par le serveur : on réessaiera plus tard, même identifiant.
      return { genre: 'reseau', erreur: new ApiError('RESEAU', MESSAGES.RESEAU) };
    }
    if (r.statutOrigine !== 'REFUSE') return { ok: r };
  }
  const motif = r.motif ?? 'INVALIDE';
  return { genre: 'definitif', erreur: new ApiError(motif, r.message ?? MESSAGES[motif], 200) };
}

export function creerFile(o: OptionsFile): FileEvenements {
  const { stockage, transport } = o;
  const maintenant = o.maintenant ?? Date.now;
  const alea = o.alea ?? Math.random;
  const planifier = o.planifier ?? planifierParDefaut;

  let lignes: Ligne[] = [];
  let chargement: Promise<void> | null = null;
  /** Change à chaque `vider()` : un envoi commencé avant n'écrit plus rien après. */
  let generation = 0;
  let echecs = 0;
  let prochainEssaiA: number | null = null;
  let annulerMinuteur: (() => void) | null = null;
  let envoiEnCours = false;
  let blocage: EtatFile['blocage'] = null;
  const attentes = new Map<string, Attente[]>();
  const abonnes = new Set<(e: EtatFile) => void>();

  // ─────────────── État ───────────────

  function etat(): EtatFile {
    return {
      enAttente: lignes.filter((l) => l.statut === 'EN_ATTENTE').length,
      refus: lignes.flatMap((l) => (l.statut === 'REFUSE' && l.refus ? [l.refus] : [])),
      envoiEnCours,
      blocage,
      prochainEssaiA,
    };
  }

  function notifier() {
    const e = etat();
    for (const cb of abonnes) cb(e);
  }

  // ─────────────── Stockage ───────────────

  function versStockage(l: Ligne): LigneStockee {
    const e = l.evenement;
    return {
      id: l.id,
      seq: l.seq,
      type: e?.type ?? l.refus?.type ?? 'SOS',
      visiteId: e ? visiteDe(e) : (l.refus?.visiteId ?? null),
      statut: l.statut,
      tentatives: l.tentatives,
      // Un refus ne garde PAS le contenu (Kayé, code, position) : seulement le motif et le message.
      contenu: JSON.stringify(l.statut === 'EN_ATTENTE' ? e : l.refus),
    };
  }

  function depuisStockage(s: LigneStockee): Ligne | null {
    try {
      const contenu = JSON.parse(s.contenu) as unknown;
      if (!contenu || typeof contenu !== 'object') return null;
      if (s.statut === 'EN_ATTENTE') {
        return { id: s.id, seq: s.seq, statut: s.statut, tentatives: s.tentatives, evenement: contenu as Evenement, refus: null };
      }
      return { id: s.id, seq: s.seq, statut: 'REFUSE', tentatives: s.tentatives, evenement: null, refus: contenu as Refus };
    } catch {
      return null;
    }
  }

  /** Écriture « au mieux » : si le stockage échoue, la ligne reste en mémoire et part quand même. */
  async function persister(l: Ligne) {
    const gen = generation;
    try {
      await stockage.ecrireLigne(versStockage(l));
      // Déconnexion pendant l'écriture : on retire ce qui vient d'être écrit.
      if (gen !== generation) await stockage.supprimerLigne(l.id);
    } catch (e) {
      if (__DEV_SAFE__) console.warn('[hors ligne] écriture impossible', e);
    }
  }

  async function oublierStockage(id: string) {
    await stockage.supprimerLigne(id).catch(() => undefined);
  }

  function charger(): Promise<void> {
    if (!chargement) {
      const gen = generation;
      chargement = (async () => {
        const brutes = await stockage.listerLignes().catch(() => [] as LigneStockee[]);
        if (gen !== generation) return;
        const lues: Ligne[] = [];
        for (const s of brutes) {
          const l = depuisStockage(s);
          if (l) lues.push(l);
          else await oublierStockage(s.id);
        }
        // Les lignes ajoutées pendant la lecture (rare) restent.
        const connues = new Set(lues.map((l) => l.id));
        lignes = [...lues, ...lignes.filter((l) => !connues.has(l.id))].sort((a, b) => a.seq - b.seq);
        notifier();
      })();
    }
    return chargement;
  }

  // ─────────────── Attentes des écrans ───────────────

  function attendre(id: string): Promise<ResultatEvenement> {
    return new Promise((resolve, reject) => {
      const liste = attentes.get(id) ?? [];
      liste.push({ resolve, reject });
      attentes.set(id, liste);
    });
  }

  function regler(id: string, issue: { ok: ResultatEvenement } | { erreur: unknown }) {
    const liste = attentes.get(id);
    if (!liste) return;
    attentes.delete(id);
    for (const a of liste) {
      if ('ok' in issue) a.resolve(issue.ok);
      else a.reject(issue.erreur);
    }
  }

  /** Après un arrêt (réseau, session) : chaque action en attente reçoit « gardé, part plus tard ». */
  function rejeterEnAttente() {
    for (const id of [...attentes.keys()]) {
      const l = lignes.find((x) => x.id === id);
      const type = l?.evenement?.type ?? 'CHECK_IN';
      regler(id, { erreur: new ApiError('EN_ATTENTE', messageAttente(type)) });
    }
  }

  // ─────────────── Envoi ───────────────

  function prochaine(): Ligne | undefined {
    const prio = (l: Ligne) => (l.evenement?.type === 'SOS' ? 0 : 1);
    return lignes.filter((l) => l.statut === 'EN_ATTENTE' && l.evenement).sort((a, b) => prio(a) - prio(b) || a.seq - b.seq)[0];
  }

  async function passe(forcer: boolean): Promise<void> {
    await charger();
    const gen = generation;
    if (!forcer && prochainEssaiA !== null && prochainEssaiA > maintenant()) return; // le minuteur relancera
    annulerMinuteur?.();
    annulerMinuteur = null;
    prochainEssaiA = null;
    envoiEnCours = true;
    notifier();
    try {
      for (;;) {
        const l = prochaine();
        if (!l || !l.evenement) {
          echecs = 0;
          blocage = null;
          return;
        }
        let issue: Issue;
        try {
          issue = interpreterResultat(await transport(l.evenement));
        } catch (e) {
          issue = { genre: classerErreur(e), erreur: e instanceof ApiError ? e : new ApiError('RESEAU', MESSAGES.RESEAU) };
        }
        if (gen !== generation) return; // déconnexion pendant l'envoi : rien n'est écrit

        if ('ok' in issue) {
          lignes = lignes.filter((x) => x !== l);
          await oublierStockage(l.id);
          echecs = 0;
          blocage = null;
          regler(l.id, issue);
          notifier();
          continue;
        }

        if (issue.genre === 'definitif') {
          const e = l.evenement;
          l.statut = 'REFUSE';
          l.refus = { id: l.id, type: e.type, visiteId: visiteDe(e), code: issue.erreur.code, message: issue.erreur.message };
          l.evenement = null;
          await persister(l);
          regler(l.id, { erreur: issue.erreur });
          notifier();
          continue;
        }

        if (issue.genre === 'reseau') {
          l.tentatives += 1;
          await persister(l);
          echecs += 1;
          blocage = 'reseau';
          const delai = delaiAttente(echecs, alea());
          prochainEssaiA = maintenant() + delai;
          annulerMinuteur = planifier(() => {
            annulerMinuteur = null;
            void synchroniser({ forcer: true });
          }, delai);
        } else {
          // Session perdue : on attend la reconnexion (`synchroniser` est relancé à l'ouverture de session).
          blocage = 'session';
        }
        rejeterEnAttente();
        return;
      }
    } finally {
      if (gen === generation) {
        envoiEnCours = false;
        notifier();
      }
    }
  }

  // Une seule passe à la fois. Les demandes pendant une passe sont regroupées en UNE passe suivante.
  let courant: Promise<void> | null = null;
  let suivant: { forcer: boolean; promesse: Promise<void> } | null = null;

  function lancer(forcer: boolean): Promise<void> {
    const p: Promise<void> = passe(forcer)
      .catch(() => {
        rejeterEnAttente();
      })
      .finally(() => {
        if (courant === p) courant = null;
      });
    courant = p;
    return p;
  }

  function synchroniser(options?: { forcer?: boolean }): Promise<void> {
    const forcer = options?.forcer ?? false;
    if (!courant) return lancer(forcer);
    if (suivant) {
      suivant.forcer ||= forcer;
      return suivant.promesse;
    }
    const s: { forcer: boolean; promesse: Promise<void> } = { forcer, promesse: Promise.resolve() };
    s.promesse = courant.then(() => {
      suivant = null;
      return lancer(s.forcer);
    });
    suivant = s;
    return s.promesse;
  }

  // ─────────────── Ajout ───────────────

  /** Regroupe les actions répétées sur la même visite (double appui, nouvel essai de l'accompagnant). */
  async function ajouter(ev: Evenement): Promise<Ligne> {
    const memeCible = lignes.find((l) => l.statut === 'EN_ATTENTE' && l.evenement?.type === ev.type && visiteDe(l.evenement) === visiteDe(ev));

    if (memeCible && (ev.type === 'CHECK_OUT' || ev.type === 'SOS')) return memeCible;

    if (memeCible && (ev.type === 'KAYE_BROUILLON' || ev.type === 'KAYE_PUBLICATION')) {
      if (memeCible.tentatives === 0) {
        // Jamais parti : on remplace le texte, on garde l'identifiant.
        memeCible.evenement = { ...ev, clientEventId: memeCible.id };
        await persister(memeCible);
        return memeCible;
      }
      // Déjà essayé : le serveur l'a peut-être reçu. Nouveau texte = nouvel identifiant, même place dans l'ordre.
      // Si le premier était arrivé, le serveur refuse le second (CONFLIT) : le refus s'affiche, rien n'est perdu en silence.
      const nouvelle: Ligne = { id: ev.clientEventId, seq: memeCible.seq, statut: 'EN_ATTENTE', tentatives: 0, evenement: ev, refus: null };
      lignes = lignes.map((l) => (l === memeCible ? nouvelle : l));
      await oublierStockage(memeCible.id);
      await persister(nouvelle);
      const anciennes = attentes.get(memeCible.id);
      if (anciennes) {
        attentes.delete(memeCible.id);
        attentes.set(nouvelle.id, [...(attentes.get(nouvelle.id) ?? []), ...anciennes]);
      }
      return nouvelle;
    }

    const existante = lignes.find((l) => l.id === ev.clientEventId);
    if (existante) return existante;
    const seq = lignes.reduce((m, l) => Math.max(m, l.seq), 0) + 1;
    const l: Ligne = { id: ev.clientEventId, seq, statut: 'EN_ATTENTE', tentatives: 0, evenement: ev, refus: null };
    lignes = [...lignes, l];
    await persister(l);
    notifier();
    return l;
  }

  return {
    async soumettre(ev) {
      const gen = generation;
      await charger();
      if (gen !== generation) throw erreurDeconnecte();
      const l = await ajouter(ev);
      if (gen !== generation) throw erreurDeconnecte();
      const resultat = attendre(l.id);
      void synchroniser({ forcer: true });
      return resultat;
    },

    synchroniser,
    etat,

    abonner(cb) {
      abonnes.add(cb);
      void charger();
      return () => {
        abonnes.delete(cb);
      };
    },

    async kayeEnAttente(visiteId) {
      await charger();
      const k = [...lignes]
        .reverse()
        .find((l) => l.statut === 'EN_ATTENTE' && (l.evenement?.type === 'KAYE_BROUILLON' || l.evenement?.type === 'KAYE_PUBLICATION') && l.evenement.visiteId === visiteId);
      const e = k?.evenement;
      return e && (e.type === 'KAYE_BROUILLON' || e.type === 'KAYE_PUBLICATION') ? { ...e.kaye } : null;
    },

    async oublierRefus(id) {
      await charger();
      const cibles = lignes.filter((l) => l.statut === 'REFUSE' && (!id || l.id === id));
      lignes = lignes.filter((l) => !cibles.includes(l));
      for (const l of cibles) await oublierStockage(l.id);
      notifier();
    },

    vider() {
      generation += 1;
      annulerMinuteur?.();
      annulerMinuteur = null;
      lignes = [];
      chargement = Promise.resolve();
      echecs = 0;
      prochainEssaiA = null;
      blocage = null;
      envoiEnCours = false;
      for (const id of [...attentes.keys()]) regler(id, { erreur: erreurDeconnecte() });
      notifier();
    },
  };
}
