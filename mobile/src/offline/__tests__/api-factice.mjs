#!/usr/bin/env node
/**
 * API v1 FACTICE pour l'e2e hors ligne (lot M3). Outil de test seulement.
 *
 * Mêmes formes que les contrats (`src/contracts`), le minimum pour le parcours :
 * connexion, /me, /visites, /visites/:id, /propositions, POST /evenements (idempotent par clientEventId).
 * Journal de test : GET /__journal → { recus, traites } ; POST /__reinitialiser.
 *
 * Usage : node src/offline/__tests__/api-factice.mjs --port 4331
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const i = process.argv.indexOf('--port');
const port = Number(i >= 0 ? process.argv[i + 1] : 4331);

const MOI = { id: 'acc_e2e', role: 'ACCOMPAGNANT', prenom: 'Josiane', nom: 'Mathurin', email: 'accompagnant@demo.koudmen.test', demo: true, bacASable: false, emailVerifie: true, profilValide: true, preinscription: false };
const jeton = (p) => p + randomBytes(24).toString('hex');

let etat;
function reinitialiser() {
  const debut = new Date(Date.now() - 20 * 60_000);
  etat = {
    /** Toutes les requêtes d'événements reçues (renvois compris). */
    recus: [],
    /** Premier traitement par clientEventId. */
    traites: new Map(),
    visite: {
      id: 'vis_e2e_leonie',
      debut: debut.toISOString(),
      fin: new Date(debut.getTime() + 120 * 60_000).toISOString(),
      statut: 'EN_COURS',
      aine: { prenom: 'Léonie', initialeNom: 'B.', commune: 'SAINTE_LUCE', communeLibelle: 'Sainte-Luce', adresseApproximative: 'Quartier Désert', interets: [] },
      demande: { niveau: 1, frequence: 'HEBDOMADAIRE', dureeMinutes: 120, consignes: 'Marché de Rivière-Pilote, puis le courrier.' },
      preuve: { score: 2, seuil: 2, facteursValides: ['CODE_DOMICILE', 'GPS'], checkInA: debut.toISOString(), checkOutA: null, horlogeSuspecte: false },
      kayePublie: false,
      actions: { checkIn: false, checkOut: true, kaye: true },
    },
  };
}
reinitialiser();

function repondre(res, statut, corps) {
  res.writeHead(statut, { 'content-type': 'application/json' });
  res.end(corps === undefined ? '' : JSON.stringify(corps));
}

const erreur = (res, statut, code, message) => repondre(res, statut, { erreur: { code, message } });

function lireCorps(req) {
  return new Promise((ok) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => {
      try {
        ok(b ? JSON.parse(b) : {});
      } catch {
        ok({});
      }
    });
  });
}

function jetons() {
  return { typeJeton: 'Bearer', jetonAcces: jeton('acc_'), expireDans: 900, jetonRenouvellement: jeton('ren_'), renouvellementExpireDans: 2_592_000 };
}

function traiter(e) {
  etat.recus.push(e);
  const deja = etat.traites.get(e.clientEventId);
  if (deja) return { ...deja, statut: 'DOUBLON', statutOrigine: deja.statut };
  const v = etat.visite;
  const base = { clientEventId: e.clientEventId, type: e.type, horlogeSuspecte: false };
  let r;
  if (e.type === 'KAYE_PUBLICATION') {
    if (v.kayePublie) r = { ...base, statut: 'REFUSE', motif: 'CONFLIT', message: 'Le Kayé de cette visite est déjà envoyé.' };
    else {
      v.kayePublie = true;
      v.actions = { ...v.actions, kaye: false };
      r = { ...base, statut: 'ACCEPTE', visite: { id: v.id, statut: v.statut, score: v.preuve.score } };
    }
  } else if (e.type === 'SOS') {
    r = { ...base, statut: 'ACCEPTE', consigne: 'L’équipe Koudmen est prévenue. En cas de danger, appelez le 15 ou le 112.' };
  } else {
    r = { ...base, statut: 'ACCEPTE' };
  }
  etat.traites.set(e.clientEventId, r);
  return r;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname.replace(/^\/api\/v1/, '');
  const authentifie = /^Bearer acc_/.test(req.headers.authorization ?? '');

  if (url.pathname === '/__journal') return repondre(res, 200, { recus: etat.recus, traites: [...etat.traites.values()] });
  if (url.pathname === '/__reinitialiser') {
    reinitialiser();
    return repondre(res, 200, { ok: true });
  }

  if (req.method === 'POST' && p === '/auth/code') {
    await lireCorps(req);
    return repondre(res, 200, { code: jeton('code_'), expireDans: 120 });
  }
  if (req.method === 'POST' && (p === '/auth/token' || p === '/auth/refresh')) {
    await lireCorps(req);
    return repondre(res, 200, jetons());
  }
  if (req.method === 'POST' && p === '/auth/logout') return repondre(res, 204);

  if (!authentifie) return erreur(res, 401, 'NON_AUTHENTIFIE', 'Connectez-vous.');

  if (p === '/me') return repondre(res, 200, MOI);
  if (p === '/visites') return repondre(res, 200, { genereA: new Date().toISOString(), jours: 7, visites: [etat.visite] });
  if (p === `/visites/${etat.visite.id}`) return repondre(res, 200, { ...etat.visite, brouillonKaye: null });
  if (p.startsWith('/visites/')) return erreur(res, 404, 'INTROUVABLE', 'Cette visite n’existe pas.');
  if (p === '/propositions') return repondre(res, 200, { propositions: [] });
  if (req.method === 'POST' && p === '/evenements') {
    const corps = await lireCorps(req);
    const resultats = (corps.evenements ?? []).map(traiter);
    return repondre(res, 200, { recuA: new Date().toISOString(), resultats });
  }
  return erreur(res, 404, 'INTROUVABLE', 'Route inconnue.');
}).listen(port, () => console.log(`API factice (lot M3) sur http://localhost:${port}`));
