import type { z } from 'zod';
import {
  reponseAcceptationSchema,
  reponseAppareilSchema,
  reponseCodeSchema,
  reponseErreurSchema,
  reponseJetonsSchema,
  reponsePropositionsSchema,
  reponseRefusSchema,
  reponseVisiteSchema,
  reponseVisitesSchema,
  type Evenement,
  type ReponseJetons,
  type ReponseVisite,
  type ResultatEvenement as Resultat,
} from '@/contracts';
import {
  demandeEvenementsSchema,
  demandeInscriptionSchema,
  demandeMotDePasseOublieSchema,
  demandePositionSchema,
  reponseEvenementsSchema,
  reponseInscriptionSchema,
  reponseMoiSchema,
  reponseTrajetSchema,
} from '@/contracts';
import { etatVerificationSchema, reponseOrientationSchema, reponsesOrientationSchema } from '@/compte/contratAccompagnant';
import { creerHorsLigne, type HorsLigne } from '@/offline';
import type { KoudmenApi } from './client';
import { MESSAGES } from './messages';
import { calculerDefi, creerVerificateur, nouvelIdEvenement } from './pkce';
import { creerStockageJeton, type StockageJeton } from './stockage';
import { ApiError, type EtatTrajetServeur, type Moi } from './types';

/**
 * Implémentation HTTP (lot M2) : routes `/api/v1` de `plateforme/` (docs/tech/api-v1.md).
 *
 * Jetons :
 * - jeton d'accès (15 min) en MÉMOIRE ;
 * - jeton de renouvellement (30 j) dans le stockage sûr (`stockage.ts`).
 *
 * Renouvellement UN PAR UN : tous les appels partagent UNE promesse de renouvellement (`enCours`).
 * Le serveur a un délai de grâce de 30 s (arbitrage V1 X1) : le même jeton présenté de nouveau dans les 30 s
 * par le même appareil renvoie la même nouvelle paire. L'app en profite UNE fois : si la réponse de /auth/refresh
 * se perd (coupure, délai dépassé), elle rejoue tout de suite le même jeton, une seule fois. Au-delà : rejeu = révocation.
 *
 * Toutes les réponses sont validées par les schémas Zod des contrats. Une réponse hors contrat donne
 * `REPONSE_INVALIDE` (jamais une donnée non vérifiée à l'écran).
 */

const DELAI_RESEAU_MS = 20_000;
/** Marge avant l'expiration du jeton d'accès : on renouvelle un peu avant. */
const MARGE_EXPIRATION_MS = 30_000;
/** Codes qui ferment la connexion locale. */
const CODES_FIN_SESSION = new Set(['JETON_INVALIDE', 'JETON_REUTILISE', 'ACCES_REFUSE']);
/**
 * Codes qui effacent AUSSI les données de l'appareil (cache, file, clé) : rejeu détecté ou compte refusé
 * (api-v1 § 1, revue sécurité PM5). `JETON_INVALIDE` (connexion expirée) garde la file : le Kayé non envoyé reste.
 */
const CODES_PURGE = new Set(['JETON_REUTILISE', 'ACCES_REFUSE']);

type Methode = 'GET' | 'POST' | 'DELETE';
type Options = { methode?: Methode; corps?: unknown; jeton?: string | null };

/** Erreurs qui donnent la copie locale (lot M3) au lieu d'un message d'erreur. */
const CODES_REPLI_CACHE = new Set(['RESEAU', 'ERREUR_INTERNE', 'TROP_DE_REQUETES']);
/** Fiches préchargées pour la lecture hors ligne (visites du jour). */
const MAX_FICHES_PRECHARGEES = 6;

export function creerApiHttp(
  baseUrl: string,
  stockage: StockageJeton = creerStockageJeton(),
  fabriqueHorsLigne: (transport: (e: Evenement) => Promise<Resultat>) => HorsLigne = (transport) => creerHorsLigne({ transport }),
): KoudmenApi {
  const api = `${baseUrl}/api/v1`;
  let acces: { jeton: string; expireA: number } | null = null;
  let enCours: Promise<void> | null = null;
  const ecouteurs = new Set<(message: string) => void>();
  // Lot M3 : file d'événements + cache. Le transport envoie UN événement (même clientEventId à chaque renvoi).
  const horsLigne = fabriqueHorsLigne(transporter);
  const repliCache = (e: unknown) => e instanceof ApiError && CODES_REPLI_CACHE.has(e.code);

  // ─────────────── Transport ───────────────

  async function appeler<S extends z.ZodTypeAny>(chemin: string, schema: S | null, opts: Options = {}): Promise<z.infer<S>> {
    const entetes: Record<string, string> = { Accept: 'application/json' };
    if (opts.corps !== undefined) entetes['Content-Type'] = 'application/json';
    if (opts.jeton) entetes.Authorization = `Bearer ${opts.jeton}`;

    // Le délai couvre la requête ET la lecture du corps (revue m6) : un corps qui cale ne gèle plus la file.
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), DELAI_RESEAU_MS);
    let res: Response;
    let texte: string;
    try {
      res = await fetch(`${api}${chemin}`, {
        method: opts.methode ?? 'GET',
        headers: entetes,
        body: opts.corps === undefined ? undefined : JSON.stringify(opts.corps),
        signal: ctrl.signal,
      });
      texte = res.status === 204 ? '' : await res.text();
    } catch {
      // Coupure pendant la requête ou pendant la lecture du corps : erreur réseau (nouvel essai), jamais « hors contrat ».
      throw new ApiError('RESEAU', MESSAGES.RESEAU);
    } finally {
      clearTimeout(minuteur);
    }

    if (res.status === 204) return undefined as z.infer<S>;
    let json: unknown = null;
    try {
      json = texte ? JSON.parse(texte) : null;
    } catch {
      json = null;
    }

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

  /**
   * Un /auth/refresh. Réponse perdue (RESEAU) : UN rejeu immédiat du même jeton, couvert par le délai de grâce
   * de 30 s du serveur (X1). Jamais plus d'un rejeu : un second échec garde le jeton pour plus tard.
   */
  async function demanderJetons(jeton: string): Promise<ReponseJetons> {
    const corps = { jetonRenouvellement: jeton };
    try {
      return await appeler('/auth/refresh', reponseJetonsSchema, { methode: 'POST', corps });
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'RESEAU') throw e;
      return appeler('/auth/refresh', reponseJetonsSchema, { methode: 'POST', corps });
    }
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
          await garder(await demanderJetons(jeton));
        } catch (e) {
          // Erreur réseau : on garde le jeton, on réessaiera. Jeton refusé : connexion terminée.
          if (e instanceof ApiError && CODES_FIN_SESSION.has(e.code)) {
            await effacer();
            // Rejeu détecté ou compte refusé : les données de l'appareil sont effacées aussi (PM5).
            if (CODES_PURGE.has(e.code)) await horsLigne.purger().catch(() => undefined);
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
    await sessionOuverte(moi);
    return moi;
  }

  /** Lot M3 : garde le compte (réouverture sans réseau), puis lance l'envoi de la file. */
  async function sessionOuverte(moi: Moi) {
    await horsLigne.cache.garderMoi(moi);
    await horsLigne.ouvrir(moi.id);
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
      // Lot M3 : purge complète (cache, file, clé de chiffrement), même hors réseau.
      await horsLigne.purger();
    }
  }

  // ─────────────── Événements ───────────────

  type SansEnveloppe<E> = E extends Evenement ? Omit<E, 'clientEventId' | 'survenuA'> : never;

  /** Transport de la file (lot M3) : POST /evenements avec UN événement. */
  async function transporter(evenement: Evenement): Promise<Resultat> {
    const reponse = await appelerAuth('/evenements', reponseEvenementsSchema, { methode: 'POST', corps: { evenements: [evenement] } });
    const r = reponse.resultats[0];
    if (!r || r.clientEventId !== evenement.clientEventId) throw new ApiError('REPONSE_INVALIDE', MESSAGES.REPONSE_INVALIDE);
    return r;
  }

  /**
   * Crée l'événement (`clientEventId` neuf, heure de l'appareil), le vérifie, puis le confie à la file (lot M3).
   * - Envoyé : résultat du serveur.
   * - Refus métier : `ApiError` avec le motif et le message du serveur.
   * - Pas de réseau : `ApiError('EN_ATTENTE')`. La file le renvoie plus tard avec le MÊME identifiant.
   */
  async function envoyer(e: SansEnveloppe<Evenement>): Promise<Resultat> {
    const evenement = { ...e, clientEventId: nouvelIdEvenement(), survenuA: new Date().toISOString() };
    const corps = demandeEvenementsSchema.safeParse({ evenements: [evenement] });
    const valide = corps.success ? corps.data.evenements[0] : undefined;
    if (!corps.success || !valide) {
      throw new ApiError('REQUETE_INVALIDE', (corps.success ? null : corps.error.issues[0]?.message) ?? MESSAGES.REQUETE_INVALIDE, 400);
    }
    // L1 : la réponse contient `controle` (contrat serveur) ; la file la rend telle quelle.
    return horsLigne.file.soumettre(valide);
  }

  /** L1 : réponse du trajet → état pour l'écran. */
  function etatTrajet(r: { trajet: { etat: 'EN_COURS' | 'ARRETE'; expireA?: string | null }; domicile?: EtatTrajetServeur['domicile'] }): EtatTrajetServeur {
    return { etat: r.trajet.etat, expireA: r.trajet.expireA ?? null, domicile: r.domicile ?? null };
  }

  /** L1 : appel public (sans jeton) avec un corps vérifié avant l'envoi. */
  async function appelerPublic<S extends z.ZodTypeAny>(chemin: string, schemaDemande: z.ZodTypeAny, corps: unknown, schemaReponse: S | null) {
    const ok = schemaDemande.safeParse(corps);
    if (!ok.success) throw new ApiError('REQUETE_INVALIDE', ok.error.issues[0]?.message ?? MESSAGES.REQUETE_INVALIDE, 400);
    return appeler(chemin, schemaReponse, { methode: 'POST', corps: ok.data });
  }

  /** Remet dans la fiche le Kayé encore dans la file (le texte écrit hors ligne n'est pas perdu à l'écran). */
  async function avecKayeEnAttente(v: ReponseVisite): Promise<ReponseVisite> {
    if (v.kayePublie) return v;
    const k = await horsLigne.file.kayeEnAttente(v.id).catch(() => null);
    return k ? { ...v, brouillonKaye: k } : v;
  }

  /** Précharge les fiches du jour (lecture hors ligne). Sans attendre, sans erreur visible. */
  function prechargerFiches(visites: { id: string }[]) {
    for (const v of visites.slice(0, MAX_FICHES_PRECHARGEES)) {
      void appelerAuth(`/visites/${encodeURIComponent(v.id)}`, reponseVisiteSchema)
        .then((f) => horsLigne.cache.garderVisite(f))
        .catch(() => undefined);
    }
  }

  // ─────────────── Interface ───────────────

  return {
    mode: 'http',
    url: baseUrl,
    horsLigne,

    async inscrire(demande) {
      await appelerPublic('/auth/inscription', demandeInscriptionSchema, { role: 'ACCOMPAGNANT', ...demande }, reponseInscriptionSchema);
    },
    async motDePasseOublie(email) {
      await appelerPublic('/auth/mot-de-passe-oublie', demandeMotDePasseOublieSchema, { email }, null);
    },

    connecter: (email, motDePasse) => ouvrirSession({ methode: 'mot_de_passe', email: email.trim(), motDePasse }),

    async restaurer() {
      const jeton = await stockage.lire().catch(() => null);
      if (!jeton) return null;
      try {
        await renouveler();
        const moi = await appelerAuth('/me', reponseMoiSchema);
        await sessionOuverte(moi);
        return moi;
      } catch (e) {
        if (e instanceof ApiError && CODES_FIN_SESSION.has(e.code)) {
          // L'écran de connexion garde l'explication (« fermée par sécurité ») : on la renvoie (revue m7).
          await effacer();
          throw e;
        }
        if (e instanceof ApiError && e.code === 'NON_AUTHENTIFIE') {
          await effacer();
          return null;
        }
        // Lot M3 : réouverture SANS réseau. Le jeton est gardé ; le compte vient du cache chiffré.
        // Les écrans lisent le cache ; la file repart au retour du réseau (le jeton est renouvelé à ce moment).
        if (repliCache(e)) {
          const moi = await horsLigne.cache.lireMoi();
          if (moi) {
            await horsLigne.ouvrir(moi.id);
            return moi;
          }
        }
        throw e;
      }
    },

    async moi() {
      const moi = await appelerAuth('/me', reponseMoiSchema);
      await horsLigne.cache.garderMoi(moi);
      return moi;
    },
    deconnecter,

    surSessionPerdue(cb) {
      ecouteurs.add(cb);
      return () => {
        ecouteurs.delete(cb);
      };
    },

    async listerVisites() {
      try {
        const r = await appelerAuth('/visites?jours=7', reponseVisitesSchema);
        const duJour = await horsLigne.cache.garderVisites(r.visites);
        prechargerFiches(duJour);
        return [...r.visites].sort((a, b) => a.debut.localeCompare(b.debut));
      } catch (e) {
        // Lot M3 : sans réseau, les visites du jour gardées sur l'appareil.
        const copie = repliCache(e) ? await horsLigne.cache.lireVisites() : null;
        if (!copie) throw e;
        return [...copie].sort((a, b) => a.debut.localeCompare(b.debut));
      }
    },
    async lireVisite(id) {
      try {
        const v = await appelerAuth(`/visites/${encodeURIComponent(id)}`, reponseVisiteSchema);
        await horsLigne.cache.garderVisite(v);
        return await avecKayeEnAttente(v);
      } catch (e) {
        const copie = repliCache(e) ? await horsLigne.cache.lireVisite(id) : null;
        if (!copie) throw e;
        return avecKayeEnAttente(copie);
      }
    },

    // D15 : contrat côté app (src/compte/contratAccompagnant.ts) en attendant celui du serveur.
    lireVerification: () => appelerAuth('/accompagnant/verification', etatVerificationSchema),
    async envoyerOrientation(reponses) {
      const ok = reponsesOrientationSchema.safeParse(reponses);
      if (!ok.success) throw new ApiError('REQUETE_INVALIDE', MESSAGES.REQUETE_INVALIDE, 400);
      return appelerAuth('/accompagnant/orientation', reponseOrientationSchema, { methode: 'POST', corps: ok.data });
    },
    async demanderVerification() {
      // Réponse vide (204) ou autre forme : on relit l'état, qui fait foi.
      const r = await appelerAuth('/accompagnant/verification', null, { methode: 'POST', corps: {} });
      const etat = etatVerificationSchema.safeParse(r);
      return etat.success ? etat.data : appelerAuth('/accompagnant/verification', etatVerificationSchema);
    },

    checkIn: (visiteId, { qr, codeDomicile, position }) =>
      envoyer({
        type: 'CHECK_IN',
        visiteId,
        ...(qr ? { qr } : {}),
        ...(codeDomicile ? { codeDomicile } : {}),
        ...(position
          ? {
              position: {
                latitude: position.latitude,
                longitude: position.longitude,
                ...(position.precisionMetres !== undefined ? { precisionMetres: position.precisionMetres } : {}),
                consentement: true as const,
                simulee: position.simulee === true,
              },
            }
          : {}),
      }),
    checkOut: (visiteId) => envoyer({ type: 'CHECK_OUT', visiteId }),
    enregistrerBrouillonKaye: (visiteId, kaye) => envoyer({ type: 'KAYE_BROUILLON', visiteId, kaye }),
    publierKaye: (visiteId, kaye) => envoyer({ type: 'KAYE_PUBLICATION', visiteId, kaye }),
    sos: (visiteId) => envoyer({ type: 'SOS', ...(visiteId ? { visiteId } : {}) }),

    async demarrerTrajet(visiteId) {
      const r = await appelerAuth(`/visites/${encodeURIComponent(visiteId)}/trajet`, reponseTrajetSchema, { methode: 'POST', corps: { action: 'DEMARRER' } });
      return etatTrajet(r);
    },
    async arreterTrajet(visiteId) {
      const r = await appelerAuth(`/visites/${encodeURIComponent(visiteId)}/trajet`, reponseTrajetSchema, { methode: 'POST', corps: { action: 'ARRETER' } });
      return etatTrajet(r);
    },
    async envoyerPosition(visiteId, position) {
      const ok = demandePositionSchema.safeParse(position);
      if (!ok.success) throw new ApiError('REQUETE_INVALIDE', MESSAGES.REQUETE_INVALIDE, 400);
      // Hors file : une position perdue n'est pas renvoyée (seule la dernière compte, L6).
      await appelerAuth(`/visites/${encodeURIComponent(visiteId)}/position`, null, { methode: 'POST', corps: ok.data });
    },

    async listerPropositions() {
      return (await appelerAuth('/propositions', reponsePropositionsSchema)).propositions;
    },
    accepterProposition: (id) => appelerAuth(`/propositions/${encodeURIComponent(id)}/accepter`, reponseAcceptationSchema, { methode: 'POST', corps: {} }),
    refuserProposition: (id, note) =>
      appelerAuth(`/propositions/${encodeURIComponent(id)}/refuser`, reponseRefusSchema, {
        methode: 'POST',
        corps: note?.trim() ? { note: note.trim() } : {},
      }),

    async enregistrerAppareil(jeton, plateforme) {
      const r = await appelerAuth('/appareils', reponseAppareilSchema, { methode: 'POST', corps: { jeton, plateforme } });
      return { id: r.id };
    },
    async retirerAppareil(id) {
      await appelerAuth(`/appareils/${encodeURIComponent(id)}`, null, { methode: 'DELETE' });
    },
  };
}
