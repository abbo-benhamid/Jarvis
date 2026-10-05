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
 * 4. Erreur réseau (ou 5xx, 429) : la file S'ARRÊTE, puis réessaie
 *    avec une attente progressive (2 s, 4 s, 8 s… 5 min au plus). L'ordre est gardé.
 * 5. Erreur métier définitive (REFUSE, 400, 404, réponse hors contrat…) : l'événement n'est PLUS envoyé.
 *    Il devient un « refus » affichable (motif + message), puis la file continue.
 *    Le contenu du Kayé est gardé (chiffré) seulement s'il est corrigeable (INVALIDE, INTERDIT, A_VERIFIER) :
 *    il revient dans le formulaire. Sinon, le refus garde seulement le motif et le message.
 * 6. DOUBLON / EN_COURS répété (réservation orpheline côté serveur) : attente progressive, puis, après
 *    `MAX_EN_COURS` réponses, la ligne sort de la file en refus « à vérifier ». La tête de file n'est jamais bloquée à vie.
 * 7. Correction pendant l'envoi (Kayé, check-in) : jamais de remplacement silencieux d'une ligne en vol.
 *    La correction prend un NOUVEL identifiant. Si l'ancienne arrive d'abord, le serveur refuse la correction (refus affiché).
 * 8. Lignes gardées illisibles pour l'instant (clé indisponible) : rien n'est effacé. Seul le SOS part ; le reste attend.
 * 9. Session perdue : la file s'arrête et garde tout. Elle repart après la reconnexion.
 * 10. Déconnexion : `vider()` (et `toutEffacer()` du stockage par l'appelant).
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
  /** Kayé refusé mais corrigeable : son contenu revient dans le formulaire (chiffré au repos). */
  kaye?: BrouillonKaye;
};

export type EtatFile = {
  /** Événements pas encore acceptés par le serveur. */
  enAttente: number;
  /** Événements refusés (définitif), à montrer une fois. */
  refus: Refus[];
  envoiEnCours: boolean;
  /**
   * Pourquoi la file est arrêtée : réseau (nouvel essai programmé), session (attente de reconnexion),
   * stockage (lignes gardées illisibles pour l'instant : clé de chiffrement indisponible ; rien n'est effacé).
   */
  blocage: 'reseau' | 'session' | 'stockage' | null;
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

/**
 * Erreurs passagères : nouvel essai plus tard.
 * `REPONSE_INVALIDE` n'en fait PAS partie : une réponse hors contrat ne change pas si l'on réessaie (app à mettre à jour).
 */
const TRANSITOIRES = new Set<CodeErreurApp>(['RESEAU', 'ERREUR_INTERNE', 'TROP_DE_REQUETES']);
/** Après ce nombre de réponses DOUBLON / EN_COURS pour la même ligne, elle sort de la file en « à vérifier » (≈ 18 min). */
export const MAX_EN_COURS = 10;
/** Refus après lesquels le Kayé reste corrigeable (le texte revient dans le formulaire). */
const REFUS_CORRIGEABLES = new Set<CodeErreurApp>(['INVALIDE', 'INTERDIT', 'A_VERIFIER']);
/** Actions dont une nouvelle saisie remplace la précédente encore en attente (même visite). */
const REMPLACABLES = new Set<TypeEvenement>(['CHECK_IN', 'KAYE_BROUILLON', 'KAYE_PUBLICATION']);
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

/** Message quand l'action n'a PAS pu être écrite sur le téléphone (stockage plein ou clé indisponible). */
export function messageAttenteMemoire(type: TypeEvenement): string {
  if (type === 'SOS') return 'Pas de réseau : l’alerte n’est pas partie. Gardez l’app ouverte : elle part au retour du réseau.';
  return 'Pas de réseau. L’envoi n’a pas pu être gardé sur ce téléphone. Gardez l’app ouverte : il part au retour du réseau.';
}

const erreurDeconnecte = () => new ApiError('NON_AUTHENTIFIE', 'Vous êtes déconnecté. Les envois en attente sont effacés de ce téléphone.');

type Ligne = {
  id: string;
  seq: number;
  statut: 'EN_ATTENTE' | 'REFUSE';
  tentatives: number;
  evenement: Evenement | null;
  refus: Refus | null;
  /** Mémoire seulement : envoi en cours pour cette ligne (le transport a l'ancien contenu). */
  enVol?: boolean;
  /** Mémoire seulement : une correction a pris la place de cette ligne pendant son envoi. */
  remplacee?: boolean;
  /** Mémoire seulement : réponses DOUBLON / EN_COURS reçues d'affilée. */
  enCoursRepetes?: number;
  /** `false` : l'écriture sur le téléphone a échoué, la ligne existe seulement en mémoire. */
  persistee?: boolean;
};

type Attente = { resolve: (r: ResultatEvenement) => void; reject: (e: unknown) => void };

type Issue = { ok: ResultatEvenement } | { genre: Genre | 'enCours'; erreur: ApiError };

function visiteDe(e: Evenement): string | null {
  return e.visiteId ?? null;
}

/** Lit la réponse du serveur pour UN événement (api-v1 § 9.2, règle 1). */
export function interpreterResultat(r: ResultatEvenement): Issue {
  if (r.statut === 'ACCEPTE') return { ok: r };
  if (r.statut === 'DOUBLON') {
    if (r.statutOrigine === 'EN_COURS') {
      // Un envoi précédent est encore traité par le serveur : on réessaiera plus tard, même identifiant.
      // Compté à part (`MAX_EN_COURS`) : une réservation orpheline ne doit pas bloquer la file à vie.
      return { genre: 'enCours', erreur: new ApiError('RESEAU', MESSAGES.RESEAU) };
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
  /** `false` tant que les lignes gardées n'ont pas pu être lues (clé indisponible…). Rien n'est effacé. */
  let charge = false;
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

  /**
   * Écriture « au mieux » : si le stockage échoue, la ligne reste en mémoire et part quand même.
   * Renvoie `false` en cas d'échec : l'écran ne dit alors PAS « gardé sur ce téléphone ».
   */
  async function persister(l: Ligne): Promise<boolean> {
    const gen = generation;
    try {
      await stockage.ecrireLigne(versStockage(l));
      // Déconnexion pendant l'écriture : on retire ce qui vient d'être écrit.
      if (gen !== generation) await stockage.supprimerLigne(l.id);
      l.persistee = true;
      return true;
    } catch (e) {
      if (__DEV_SAFE__) console.warn('[hors ligne] écriture impossible', e);
      l.persistee = false;
      return false;
    }
  }

  async function oublierStockage(id: string) {
    await stockage.supprimerLigne(id).catch(() => undefined);
  }

  /**
   * Lit les lignes gardées. Un échec de lecture (clé de chiffrement indisponible, base occupée) n'efface RIEN
   * et n'est pas mémorisé : la lecture est refaite au prochain appel.
   */
  function charger(): Promise<void> {
    if (!chargement) {
      const gen = generation;
      let p: Promise<void> | null = null;
      p = (async () => {
        let brutes: LigneStockee[];
        try {
          brutes = await stockage.listerLignes();
        } catch (e) {
          if (__DEV_SAFE__) console.warn('[hors ligne] lecture impossible pour l’instant', e);
          if (gen === generation && chargement === p) chargement = null;
          notifier();
          return;
        }
        if (gen !== generation) return;
        const lues: Ligne[] = [];
        for (const s of brutes) {
          const l = depuisStockage(s);
          if (l) lues.push({ ...l, persistee: true });
          else await oublierStockage(s.id);
        }
        // Les lignes ajoutées pendant la lecture (ou pendant un échec de lecture) restent, APRÈS les lignes gardées.
        const connues = new Set(lues.map((l) => l.id));
        const max = lues.reduce((m, l) => Math.max(m, l.seq), 0);
        const ajoutees = lignes.filter((l) => !connues.has(l.id)).sort((a, b) => a.seq - b.seq);
        let dernier = max;
        for (const l of ajoutees) {
          if (l.seq <= max) {
            l.seq = ++dernier;
            await persister(l);
          } else dernier = Math.max(dernier, l.seq);
        }
        lignes = [...lues, ...ajoutees].sort((a, b) => a.seq - b.seq);
        charge = true;
        notifier();
      })();
      chargement = p;
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
      const message = l?.persistee === false ? messageAttenteMemoire(type) : messageAttente(type);
      regler(id, { erreur: new ApiError('EN_ATTENTE', message) });
    }
  }

  // ─────────────── Envoi ───────────────

  function prochaine(): Ligne | undefined {
    const prio = (l: Ligne) => (l.evenement?.type === 'SOS' ? 0 : 1);
    // Lignes gardées pas encore lues : seul le SOS part (l'ordre des autres n'est pas connu).
    const candidates = lignes.filter((l) => l.statut === 'EN_ATTENTE' && l.evenement && (charge || l.evenement.type === 'SOS'));
    return candidates.sort((a, b) => prio(a) - prio(b) || a.seq - b.seq)[0];
  }

  /** Programme le prochain essai (attente progressive). */
  function programmer() {
    echecs += 1;
    const delai = delaiAttente(echecs, alea());
    prochainEssaiA = maintenant() + delai;
    annulerMinuteur = planifier(() => {
      annulerMinuteur = null;
      void synchroniser({ forcer: true });
    }, delai);
  }

  /** Transforme la ligne en refus affichable. Garde le Kayé seulement s'il est corrigeable. */
  async function refuser(l: Ligne, e: Evenement, erreur: ApiError) {
    const kaye =
      REFUS_CORRIGEABLES.has(erreur.code) && (e.type === 'KAYE_PUBLICATION' || e.type === 'KAYE_BROUILLON') ? { kaye: { ...e.kaye } } : {};
    l.statut = 'REFUSE';
    l.refus = { id: l.id, type: e.type, visiteId: visiteDe(e), code: erreur.code, message: erreur.message, ...kaye };
    l.evenement = null;
    await persister(l);
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
          if (!charge) {
            // Lignes gardées illisibles pour l'instant : nouvelle lecture plus tard, sans rien effacer.
            blocage = 'stockage';
            programmer();
            rejeterEnAttente();
            return;
          }
          echecs = 0;
          blocage = null;
          return;
        }
        const e = l.evenement;
        let issue: Issue;
        l.enVol = true;
        try {
          issue = interpreterResultat(await transport(e));
        } catch (err) {
          issue = { genre: classerErreur(err), erreur: err instanceof ApiError ? err : new ApiError('RESEAU', MESSAGES.RESEAU) };
        } finally {
          l.enVol = false;
        }
        if (gen !== generation) return; // déconnexion pendant l'envoi : rien n'est écrit

        // Une correction a pris la place de cette ligne pendant l'envoi : la correction part ensuite, avec son propre
        // identifiant. L'ancienne n'est plus gardée. Si elle est arrivée, le serveur refuse la correction (refus affiché).
        if (l.remplacee && ('ok' in issue || issue.genre === 'definitif')) {
          regler(l.id, 'ok' in issue ? issue : { erreur: issue.erreur });
          continue;
        }

        if ('ok' in issue) {
          lignes = lignes.filter((x) => x !== l);
          await oublierStockage(l.id);
          echecs = 0;
          blocage = null;
          regler(l.id, issue);
          notifier();
          continue;
        }

        if (issue.genre === 'enCours' && !l.remplacee) {
          l.enCoursRepetes = (l.enCoursRepetes ?? 0) + 1;
          if (l.enCoursRepetes >= MAX_EN_COURS) {
            // Le serveur ne finit jamais ce traitement : on libère la tête de file et on le dit (« à vérifier »).
            const erreur = new ApiError('A_VERIFIER', MESSAGES.A_VERIFIER);
            await refuser(l, e, erreur);
            regler(l.id, { erreur });
            notifier();
            continue;
          }
        }

        if (issue.genre === 'definitif') {
          await refuser(l, e, issue.erreur);
          regler(l.id, { erreur: issue.erreur });
          notifier();
          continue;
        }

        if (issue.genre === 'reseau' || issue.genre === 'enCours') {
          if (!l.remplacee) {
            l.tentatives += 1;
            await persister(l);
          }
          blocage = 'reseau';
          programmer();
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

  /** Un nouveau Kayé pour la visite : les anciens Kayés refusés ne reviennent plus dans le formulaire. */
  async function oublierKayeRefuse(visiteId: string | null) {
    for (const l of lignes) {
      if (l.statut === 'REFUSE' && l.refus?.kaye && l.refus.visiteId === visiteId) {
        delete l.refus.kaye;
        await persister(l);
      }
    }
  }

  /** Regroupe les actions répétées sur la même visite (double appui, nouvel essai de l'accompagnant). */
  async function ajouter(ev: Evenement): Promise<Ligne> {
    const memeCible = lignes.find(
      (l) => l.statut === 'EN_ATTENTE' && !l.remplacee && l.evenement?.type === ev.type && visiteDe(l.evenement) === visiteDe(ev),
    );

    if (ev.type === 'KAYE_BROUILLON' || ev.type === 'KAYE_PUBLICATION') await oublierKayeRefuse(visiteDe(ev));

    if (memeCible && (ev.type === 'CHECK_OUT' || ev.type === 'SOS')) return memeCible;

    if (memeCible?.evenement && REMPLACABLES.has(ev.type)) {
      // Check-in : on garde le dernier code ET la dernière position (une saisie ne fait pas perdre l'autre preuve).
      const contenu: Evenement = ev.type === 'CHECK_IN' && memeCible.evenement.type === 'CHECK_IN' ? { ...memeCible.evenement, ...ev } : ev;
      if (memeCible.tentatives === 0 && !memeCible.enVol) {
        // Jamais parti et pas en cours d'envoi : on remplace le contenu, on garde l'identifiant.
        memeCible.evenement = { ...contenu, clientEventId: memeCible.id };
        await persister(memeCible);
        return memeCible;
      }
      // Déjà essayé OU en cours d'envoi : le serveur l'a peut-être reçu. Jamais de remplacement silencieux :
      // nouveau contenu = nouvel identifiant, même place dans l'ordre. Si le premier est arrivé,
      // le serveur refuse le second (CONFLIT) : le refus s'affiche, rien n'est perdu en silence.
      const nouvelle: Ligne = {
        id: ev.clientEventId,
        seq: memeCible.seq,
        statut: 'EN_ATTENTE',
        tentatives: 0,
        evenement: { ...contenu, clientEventId: ev.clientEventId },
        refus: null,
      };
      if (memeCible.enVol) memeCible.remplacee = true;
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
      if (e && (e.type === 'KAYE_BROUILLON' || e.type === 'KAYE_PUBLICATION')) return { ...e.kaye };
      // Sinon : un Kayé refusé mais corrigeable revient dans le formulaire (jamais à réécrire de mémoire).
      const refuse = [...lignes].reverse().find((l) => l.statut === 'REFUSE' && l.refus?.kaye && l.refus.visiteId === visiteId);
      return refuse?.refus?.kaye ? { ...refuse.refus.kaye } : null;
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
      charge = true;
      echecs = 0;
      prochainEssaiA = null;
      blocage = null;
      envoiEnCours = false;
      for (const id of [...attentes.keys()]) regler(id, { erreur: erreurDeconnecte() });
      notifier();
    },
  };
}
