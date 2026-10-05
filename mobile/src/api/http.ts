import type { z } from 'zod';
import {
  demandeEvenementsSchema,
  reponseAcceptationSchema,
  reponseCodeSchema,
  reponseErreurSchema,
  reponseEvenementsSchema,
  reponseJetonsSchema,
  reponseMoiSchema,
  reponsePropositionsSchema,
  reponseRefusSchema,
  reponseVisiteSchema,
  reponseVisitesSchema,
  type Evenement,
  type ReponseJetons,
} from '@/contracts';
import type { KoudmenApi } from './client';
import { MESSAGES } from './messages';
import { calculerDefi, creerVerificateur, nouvelIdEvenement } from './pkce';
import { creerStockageJeton, type StockageJeton } from './stockage';
import { ApiError, type Moi, type ResultatEvenement } from './types';

/**
 * Implémentation HTTP (lot M2) : routes `/api/v1` de `plateforme/` (docs/tech/api-v1.md).
 *
 * Jetons :
 * - jeton d'accès (15 min) en MÉMOIRE ;
 * - jeton de renouvellement (30 j) dans le stockage sûr (`stockage.ts`).
 *
 * Renouvellement UN PAR UN : le serveur n'a pas de délai de grâce (api-v1 § 8). Deux /auth/refresh
 * simultanés avec le même jeton révoqueraient la connexion. Tous les appels partagent donc UNE promesse
 * de renouvellement (`enCours`) : le premier la crée, les autres l'attendent.
 *
 * Toutes les réponses sont validées par les schémas Zod des contrats. Une réponse hors contrat donne
 * `REPONSE_INVALIDE` (jamais une donnée non vérifiée à l'écran).
 */

const DELAI_RESEAU_MS = 20_000;
/** Marge avant l'expiration du jeton d'accès : on renouvelle un peu avant. */
const MARGE_EXPIRATION_MS = 30_000;
/** Codes qui ferment la connexion locale. */
const CODES_FIN_SESSION = new Set(['JETON_INVALIDE', 'JETON_REUTILISE', 'ACCES_REFUSE']);

type Methode = 'GET' | 'POST';
type Options = { methode?: Methode; corps?: unknown; jeton?: string | null };

export function creerApiHttp(baseUrl: string, stockage: StockageJeton = creerStockageJeton()): KoudmenApi {
  const api = `${baseUrl}/api/v1`;
  let acces: { jeton: string; expireA: number } | null = null;
  let enCours: Promise<void> | null = null;
  const ecouteurs = new Set<(message: string) => void>();

  // ─────────────── Transport ───────────────

  async function appeler<S extends z.ZodTypeAny>(chemin: string, schema: S | null, opts: Options = {}): Promise<z.infer<S>> {
    const entetes: Record<string, string> = { Accept: 'application/json' };
    if (opts.corps !== undefined) entetes['Content-Type'] = 'application/json';
    if (opts.jeton) entetes.Authorization = `Bearer ${opts.jeton}`;

    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), DELAI_RESEAU_MS);
    let res: Response;
    try {
      res = await fetch(`${api}${chemin}`, {
        method: opts.methode ?? 'GET',
        headers: entetes,
        body: opts.corps === undefined ? undefined : JSON.stringify(opts.corps),
        signal: ctrl.signal,
      });
    } catch {
      throw new ApiError('RESEAU', MESSAGES.RESEAU);
    } finally {
      clearTimeout(minuteur);
    }

    if (res.status === 204) return undefined as z.infer<S>;
    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const err = reponseErreurSchema.safeParse(json);
      if (err.success) throw new ApiError(err.data.erreur.code, err.data.erreur.message, res.status);
      const code = res.status === 401 ? 'NON_AUTHENTIFIE' : res.status === 404 ? 'INTROUVABLE' : res.status === 429 ? 'TROP_DE_REQUETES' : 'ERREUR_INTERNE';
      throw new ApiError(code, MESSAGES[code], res.status);
    }
    if (!schema) return json as z.infer<S>;
    const ok = schema.safeParse(json);
    if (!ok.success) {
      if (__DEV__) console.warn(`[api] réponse hors contrat pour ${chemin}`, ok.error.issues);
      throw new ApiError('REPONSE_INVALIDE', MESSAGES.REPONSE_INVALIDE, res.status);
    }
    return ok.data as z.infer<S>;
  }

  // ─────────────── Jetons ───────────────

  async function garder(j: ReponseJetons) {
    // Écrire le NOUVEAU jeton de renouvellement avant tout autre appel : l'ancien est mort.
    await stockage.ecrire(j.jetonRenouvellement);
    acces = { jeton: j.jetonAcces, expireA: Date.now() + j.expireDans * 1000 };
  }

  async function effacer() {
    acces = null;
    await stockage.effacer().catch(() => undefined);
  }

  function signalerPerte(message: string) {
    for (const cb of ecouteurs) cb(message);
  }

  /** Renouvellement sérialisé : un seul /auth/refresh à la fois, partagé par tous les appels. */
  function renouveler(): Promise<void> {
    if (!enCours) {
      enCours = (async () => {
        const jeton = await stockage.lire();
        if (!jeton) {
          await effacer();
          throw new ApiError('JETON_INVALIDE', MESSAGES.JETON_INVALIDE, 401);
        }
        try {
          await garder(await appeler('/auth/refresh', reponseJetonsSchema, { methode: 'POST', corps: { jetonRenouvellement: jeton } }));
        } catch (e) {
          // Erreur réseau : on garde le jeton, on réessaiera. Jeton refusé : connexion terminée.
          if (e instanceof ApiError && CODES_FIN_SESSION.has(e.code)) {
            await effacer();
            signalerPerte(e.message);
          }
          throw e;
        }
      })().finally(() => {
        enCours = null;
      });
    }
    return enCours;
  }

  /** Jeton d'accès valide (renouvelé si besoin, en attendant un renouvellement déjà lancé). */
  async function jetonValide(): Promise<string> {
    if (enCours) await enCours;
    if (!acces || acces.expireA - MARGE_EXPIRATION_MS < Date.now()) await renouveler();
    if (!acces) throw new ApiError('NON_AUTHENTIFIE', MESSAGES.NON_AUTHENTIFIE, 401);
    return acces.jeton;
  }

  /** Appel protégé : Bearer, puis UN renouvellement et UN nouvel essai si le serveur répond NON_AUTHENTIFIE. */
  async function appelerAuth<S extends z.ZodTypeAny>(chemin: string, schema: S | null, opts: Omit<Options, 'jeton'> = {}) {
    const jeton = await jetonValide();
    try {
      return await appeler(chemin, schema, { ...opts, jeton });
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'NON_AUTHENTIFIE') throw e;
      // Un autre appel a peut-être déjà renouvelé : on ne renouvelle que si le jeton n'a pas changé.
      if (acces?.jeton === jeton) {
        acces = null;
        await renouveler();
      } else if (enCours) {
        await enCours;
      }
      if (!acces) throw e;
      return appeler(chemin, schema, { ...opts, jeton: acces.jeton });
    }
  }

  async function ouvrirSession(corpsCode: Record<string, unknown>): Promise<Moi> {
    const verificateur = creerVerificateur();
    const codeChallenge = await calculerDefi(verificateur);
    const { code } = await appeler('/auth/code', reponseCodeSchema, { methode: 'POST', corps: { ...corpsCode, codeChallenge } });
    await garder(await appeler('/auth/token', reponseJetonsSchema, { methode: 'POST', corps: { code, codeVerifier: verificateur } }));
    const moi = await appelerAuth('/me', reponseMoiSchema);
    if (moi.role !== 'ACCOMPAGNANT') {
      await deconnecter();
      throw new ApiError('ACCES_REFUSE', 'Cette app est réservée aux accompagnants. Les familles utilisent le site Koudmen.', 403);
    }
    return moi;
  }

  async function deconnecter() {
    const jeton = await stockage.lire().catch(() => null);
    const bearer = acces && acces.expireA > Date.now() ? acces.jeton : null;
    try {
      if (jeton || bearer) {
        await appeler('/auth/logout', null, { methode: 'POST', corps: jeton ? { jetonRenouvellement: jeton } : {}, jeton: bearer });
      }
    } catch {
      // Déconnexion locale quoi qu'il arrive (réseau coupé) : le jeton expirera côté serveur.
    } finally {
      await effacer();
    }
  }

  // ─────────────── Événements ───────────────

  type SansEnveloppe<E> = E extends Evenement ? Omit<E, 'clientEventId' | 'survenuA'> : never;

  /**
   * Envoie UN événement avec un `clientEventId` neuf. Une coupure réseau donne un nouvel essai
   * avec le MÊME identifiant : le serveur répond DOUBLON avec le résultat d'origine (idempotence).
   * Un refus métier (REFUSE) lève une `ApiError` avec le motif et le message du serveur.
   */
  async function envoyer(e: SansEnveloppe<Evenement>): Promise<ResultatEvenement> {
    const evenement = { ...e, clientEventId: nouvelIdEvenement(), survenuA: new Date().toISOString() };
    const corps = demandeEvenementsSchema.safeParse({ evenements: [evenement] });
    if (!corps.success) {
      throw new ApiError('REQUETE_INVALIDE', corps.error.issues[0]?.message ?? MESSAGES.REQUETE_INVALIDE, 400);
    }
    let reponse;
    try {
      reponse = await appelerAuth('/evenements', reponseEvenementsSchema, { methode: 'POST', corps: corps.data });
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== 'RESEAU') throw err;
      await new Promise((r) => setTimeout(r, 800));
      reponse = await appelerAuth('/evenements', reponseEvenementsSchema, { methode: 'POST', corps: corps.data });
    }
    const r = reponse.resultats[0];
    if (!r) throw new ApiError('REPONSE_INVALIDE', MESSAGES.REPONSE_INVALIDE);
    const refuse = r.statut === 'REFUSE' || (r.statut === 'DOUBLON' && r.statutOrigine === 'REFUSE');
    if (refuse) {
      const motif = r.motif ?? 'INVALIDE';
      throw new ApiError(motif, r.message ?? MESSAGES[motif], 200);
    }
    return r;
  }

  // ─────────────── Interface ───────────────

  return {
    mode: 'http',
    url: baseUrl,

    connecter: (email, motDePasse) => ouvrirSession({ methode: 'mot_de_passe', email: email.trim(), motDePasse }),
    connecterDemo: () => ouvrirSession({ methode: 'demo', role: 'ACCOMPAGNANT' }),

    async restaurer() {
      const jeton = await stockage.lire().catch(() => null);
      if (!jeton) return null;
      try {
        await renouveler();
        return await appelerAuth('/me', reponseMoiSchema);
      } catch (e) {
        if (e instanceof ApiError && (CODES_FIN_SESSION.has(e.code) || e.code === 'NON_AUTHENTIFIE')) {
          await effacer();
          return null;
        }
        throw e;
      }
    },

    moi: () => appelerAuth('/me', reponseMoiSchema),
    deconnecter,

    surSessionPerdue(cb) {
      ecouteurs.add(cb);
      return () => {
        ecouteurs.delete(cb);
      };
    },

    async listerVisites() {
      const r = await appelerAuth('/visites?jours=7', reponseVisitesSchema);
      return [...r.visites].sort((a, b) => a.debut.localeCompare(b.debut));
    },
    lireVisite: (id) => appelerAuth(`/visites/${encodeURIComponent(id)}`, reponseVisiteSchema),

    checkIn: (visiteId, { codeDomicile, position }) =>
      envoyer({
        type: 'CHECK_IN',
        visiteId,
        ...(codeDomicile ? { codeDomicile } : {}),
        ...(position ? { position: { ...position, consentement: true as const } } : {}),
      }),
    checkOut: (visiteId) => envoyer({ type: 'CHECK_OUT', visiteId }),
    enregistrerBrouillonKaye: (visiteId, kaye) => envoyer({ type: 'KAYE_BROUILLON', visiteId, kaye }),
    publierKaye: (visiteId, kaye) => envoyer({ type: 'KAYE_PUBLICATION', visiteId, kaye }),
    sos: (visiteId) => envoyer({ type: 'SOS', ...(visiteId ? { visiteId } : {}) }),

    async listerPropositions() {
      return (await appelerAuth('/propositions', reponsePropositionsSchema)).propositions;
    },
    accepterProposition: (id) => appelerAuth(`/propositions/${encodeURIComponent(id)}/accepter`, reponseAcceptationSchema, { methode: 'POST', corps: {} }),
    refuserProposition: (id, note) =>
      appelerAuth(`/propositions/${encodeURIComponent(id)}/refuser`, reponseRefusSchema, {
        methode: 'POST',
        corps: note?.trim() ? { note: note.trim() } : {},
      }),
  };
}
