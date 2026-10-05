import { expect, test } from '@playwright/test';
import { ApiError } from '../../api/types';
import { ATTENTE_MAX_MS, classerErreur, creerFile, delaiAttente } from '../file';
import { stockageMemoire } from '../memoire';
import { ev, laisserFinir, minuteursManuels, serveurFactice } from './aides';

/** Tests unitaires de la file d'événements (lot M3) : ordre, doublons, reprise, erreurs, purge. */

function monter(options: { reseau?: boolean } = {}) {
  const stockage = stockageMemoire();
  const serveur = serveurFactice();
  serveur.reseau = options.reseau ?? true;
  const minuteurs = minuteursManuels();
  let maintenant = 1_000_000;
  const file = creerFile({ stockage, transport: serveur.transport, planifier: minuteurs.planifier, alea: () => 0, maintenant: () => maintenant });
  return { stockage, serveur, minuteurs, file, avancer: (ms: number) => (maintenant += ms) };
}

test.describe('envoi', () => {
  test('en ligne : soumettre renvoie le résultat du serveur et vide la file', async () => {
    const { file, serveur, stockage } = monter();
    const r = await file.soumettre(ev.sos('vis_1'));
    expect(r).toMatchObject({ statut: 'ACCEPTE', type: 'SOS', consigne: 'Appelez le 15 ou le 112.' });
    expect(file.etat().enAttente).toBe(0);
    expect(await stockage.listerLignes()).toEqual([]);
    expect(serveur.recus).toHaveLength(1);
  });

  test('hors ligne : EN_ATTENTE avec un message clair, l’événement reste gardé', async () => {
    const { file, stockage } = monter({ reseau: false });
    const e = ev.kaye();
    await expect(file.soumettre(e)).rejects.toMatchObject({ code: 'EN_ATTENTE', message: expect.stringContaining('Le Kayé est gardé') });
    expect(file.etat()).toMatchObject({ enAttente: 1, blocage: 'reseau' });
    const lignes = await stockage.listerLignes();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ id: e.clientEventId, statut: 'EN_ATTENTE', tentatives: 1 });
  });

  test('SOS hors ligne : le message dit que l’alerte n’est pas partie (l’écran propose le 15 et le 112)', async () => {
    const { file } = monter({ reseau: false });
    await expect(file.soumettre(ev.sos())).rejects.toMatchObject({ code: 'EN_ATTENTE', message: expect.stringMatching(/alerte n’est pas partie/) });
  });
});

test.describe('ordre', () => {
  test('les événements gardés partent dans l’ordre d’arrivée', async () => {
    const { file, serveur } = monter({ reseau: false });
    const a = ev.checkIn();
    const b = ev.brouillon();
    const c = ev.checkOut();
    for (const e of [a, b, c]) await file.soumettre(e).catch(() => undefined);
    expect(serveur.recus).toHaveLength(0);
    expect(file.etat().enAttente).toBe(3);

    serveur.reseau = true;
    await file.synchroniser({ forcer: true });
    expect(serveur.recus.map((e) => e.clientEventId)).toEqual([a.clientEventId, b.clientEventId, c.clientEventId]);
    expect(file.etat().enAttente).toBe(0);
  });

  test('un SOS passe devant les autres événements gardés', async () => {
    const { file, serveur } = monter({ reseau: false });
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    await file.soumettre(ev.kaye()).catch(() => undefined);
    serveur.reseau = true;
    const r = await file.soumettre(ev.sos('vis_1'));
    expect(r.type).toBe('SOS');
    await laisserFinir();
    expect(serveur.recus.map((e) => e.type)).toEqual(['SOS', 'CHECK_IN', 'KAYE_PUBLICATION']);
  });

  test('erreur réseau sur le 1er : les suivants ne partent pas avant lui', async () => {
    const { file, serveur } = monter({ reseau: false });
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    await file.soumettre(ev.checkOut()).catch(() => undefined);
    expect(serveur.recus).toHaveLength(0);
    expect(file.etat().enAttente).toBe(2);
  });
});

test.describe('doublons', () => {
  test('réponse perdue : renvoi avec le MÊME clientEventId, le serveur traite une seule fois', async () => {
    const { file, serveur, minuteurs } = monter();
    serveur.perdreProchaineReponse = true;
    const e = ev.kaye();
    await expect(file.soumettre(e)).rejects.toMatchObject({ code: 'EN_ATTENTE' });
    expect(serveur.traites.size).toBe(1);

    minuteurs.declencher();
    await laisserFinir();
    expect(serveur.recus.map((x) => x.clientEventId)).toEqual([e.clientEventId, e.clientEventId]);
    expect(serveur.acceptes()).toEqual(['KAYE_PUBLICATION']);
    expect(file.etat()).toMatchObject({ enAttente: 0, refus: [] });
  });

  test('DOUBLON d’un refus : refus définitif, pas un succès', async () => {
    const { file, serveur, minuteurs } = monter();
    serveur.refuser = (e) => (e.type === 'CHECK_IN' ? 'INVALIDE' : null);
    serveur.perdreProchaineReponse = true;
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    minuteurs.declencher();
    await laisserFinir();
    expect(file.etat().refus).toEqual([expect.objectContaining({ type: 'CHECK_IN', code: 'INVALIDE' })]);
  });

  test('DOUBLON « EN_COURS » : nouvel essai plus tard, même identifiant', async () => {
    const { file, serveur, minuteurs } = monter();
    serveur.enCoursUneFois = true;
    const e = ev.checkOut();
    await expect(file.soumettre(e)).rejects.toMatchObject({ code: 'EN_ATTENTE' });
    minuteurs.declencher();
    await laisserFinir();
    expect(serveur.recus.map((x) => x.clientEventId)).toEqual([e.clientEventId, e.clientEventId]);
    expect(file.etat().enAttente).toBe(0);
  });

  test('double appui hors ligne : un seul départ, un seul SOS dans la file', async () => {
    const { file, serveur } = monter({ reseau: false });
    for (let i = 0; i < 3; i++) await file.soumettre(ev.checkOut()).catch(() => undefined);
    for (let i = 0; i < 2; i++) await file.soumettre(ev.sos('vis_1')).catch(() => undefined);
    expect(file.etat().enAttente).toBe(2);
    serveur.reseau = true;
    await file.synchroniser({ forcer: true });
    expect(serveur.recus.map((e) => e.type).sort()).toEqual(['CHECK_OUT', 'SOS']);
  });

  test('Kayé corrigé après un échec réseau : le dernier texte part, à la même place dans l’ordre', async () => {
    const { file, serveur } = monter({ reseau: false });
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    await file.soumettre(ev.kaye('vis_1', 'Premier texte')).catch(() => undefined);
    await file.soumettre(ev.checkOut()).catch(() => undefined);
    await file.soumettre(ev.kaye('vis_1', 'Texte corrigé')).catch(() => undefined);
    expect(file.etat().enAttente).toBe(3);
    expect(await file.kayeEnAttente('vis_1')).toMatchObject({ note: 'Texte corrigé' });
    serveur.reseau = true;
    await file.synchroniser({ forcer: true });
    expect(serveur.recus.map((e) => e.type)).toEqual(['CHECK_IN', 'KAYE_PUBLICATION', 'CHECK_OUT']);
    const kaye = serveur.recus[1];
    expect(kaye?.type === 'KAYE_PUBLICATION' && kaye.kaye.note).toBe('Texte corrigé');
  });
});

test.describe('erreurs', () => {
  test('erreur métier définitive : plus jamais renvoyé, refus affichable SANS le Kayé, la file continue', async () => {
    const { file, serveur, stockage, minuteurs } = monter({ reseau: false });
    serveur.refuser = (e) => (e.type === 'KAYE_PUBLICATION' ? 'CONFLIT' : null);
    const k = ev.kaye();
    await file.soumettre(k).catch(() => undefined);
    await file.soumettre(ev.checkOut()).catch(() => undefined);
    serveur.reseau = true;
    await file.synchroniser({ forcer: true });

    expect(serveur.recus.map((e) => e.type)).toEqual(['KAYE_PUBLICATION', 'CHECK_OUT']);
    const etat = file.etat();
    expect(etat.enAttente).toBe(0);
    expect(etat.refus).toEqual([{ id: k.clientEventId, type: 'KAYE_PUBLICATION', visiteId: 'vis_1', code: 'CONFLIT', message: 'Refusé : CONFLIT' }]);
    const lignes = await stockage.listerLignes();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.contenu).not.toContain('dominos');

    // Rien n'est renvoyé ensuite, même au retour du réseau.
    await file.synchroniser({ forcer: true });
    minuteurs.declencher();
    await laisserFinir();
    expect(serveur.recus).toHaveLength(2);

    await file.oublierRefus();
    expect(file.etat().refus).toEqual([]);
    expect(await stockage.listerLignes()).toEqual([]);
  });

  test('refus métier pendant soumettre : ApiError avec le motif et le message du serveur', async () => {
    const { file, serveur } = monter();
    serveur.refuser = () => 'INVALIDE';
    await expect(file.soumettre(ev.checkIn())).rejects.toMatchObject({ code: 'INVALIDE', message: 'Refusé : INVALIDE' });
  });

  test('erreur réseau : attente progressive 2 s, 4 s, 8 s… plafonnée à 5 min', async () => {
    const { file, serveur, minuteurs } = monter({ reseau: false });
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    const delais: number[] = [];
    for (let i = 0; i < 4; i++) {
      const actifs = minuteurs.actifs();
      expect(actifs).toHaveLength(1);
      delais.push(actifs[0]!.ms);
      minuteurs.declencher();
      await laisserFinir();
    }
    expect(delais).toEqual([2000, 4000, 8000, 16000]);
    expect(delaiAttente(30, 0)).toBe(ATTENTE_MAX_MS);
    expect(delaiAttente(1, 0.999)).toBeLessThanOrEqual(2400);

    serveur.reseau = true;
    minuteurs.declencher();
    await laisserFinir();
    expect(file.etat()).toMatchObject({ enAttente: 0, blocage: null, prochainEssaiA: null });
  });

  test('pendant l’attente, une synchro non forcée n’envoie rien ; le retour du réseau (forcé) envoie', async () => {
    const { file, serveur } = monter({ reseau: false });
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    serveur.reseau = true;
    await file.synchroniser();
    expect(serveur.recus).toHaveLength(0);
    await file.synchroniser({ forcer: true });
    expect(serveur.recus).toHaveLength(1);
  });

  test('5xx et 429 : erreur réseau (nouvel essai). 400 et 404 : définitive. Session perdue : arrêt sans minuteur', async () => {
    expect(classerErreur(new ApiError('ERREUR_INTERNE', 'x', 500))).toBe('reseau');
    expect(classerErreur(new ApiError('TROP_DE_REQUETES', 'x', 429))).toBe('reseau');
    expect(classerErreur(new TypeError('fetch failed'))).toBe('reseau');
    expect(classerErreur(new ApiError('REQUETE_INVALIDE', 'x', 400))).toBe('definitif');
    expect(classerErreur(new ApiError('INTROUVABLE', 'x', 404))).toBe('definitif');
    expect(classerErreur(new ApiError('JETON_REUTILISE', 'x', 401))).toBe('session');

    const { file, serveur, minuteurs } = monter();
    serveur.erreurUneFois = new ApiError('JETON_INVALIDE', 'Connexion expirée', 401);
    const e = ev.kaye();
    await expect(file.soumettre(e)).rejects.toMatchObject({ code: 'EN_ATTENTE' });
    expect(file.etat()).toMatchObject({ enAttente: 1, blocage: 'session' });
    expect(minuteurs.actifs()).toHaveLength(0);
    // Reconnexion : la session rouvre la file.
    await file.synchroniser({ forcer: true });
    expect(serveur.recus.map((x) => x.clientEventId)).toEqual([e.clientEventId]);
  });
});

test.describe('reprise', () => {
  test('réouverture de l’app : une nouvelle file sur le même stockage renvoie tout, mêmes identifiants, même ordre', async () => {
    const avant = monter({ reseau: false });
    const a = ev.checkIn();
    const b = ev.kaye();
    await avant.file.soumettre(a).catch(() => undefined);
    await avant.file.soumettre(b).catch(() => undefined);
    avant.file.vider(); // l'app est fermée : la mémoire disparaît… (ici on garde le stockage)

    const serveur = serveurFactice();
    const apres = creerFile({ stockage: avant.stockage, transport: serveur.transport, planifier: minuteursManuels().planifier });
    await apres.synchroniser({ forcer: true });
    expect(serveur.recus.map((e) => e.clientEventId)).toEqual([a.clientEventId, b.clientEventId]);
    expect(apres.etat().enAttente).toBe(0);
  });

  test('une ligne illisible dans le stockage est ignorée et effacée', async () => {
    const { stockage } = monter();
    await stockage.ecrireLigne({ id: 'abime', seq: 1, type: 'CHECK_IN', visiteId: 'v', statut: 'EN_ATTENTE', tentatives: 0, contenu: '{pas du json' });
    const serveur = serveurFactice();
    const file = creerFile({ stockage, transport: serveur.transport, planifier: minuteursManuels().planifier });
    await file.synchroniser({ forcer: true });
    expect(serveur.recus).toHaveLength(0);
    expect(await stockage.listerLignes()).toEqual([]);
  });
});

test.describe('purge à la déconnexion', () => {
  test('vider : file vide, minuteur annulé, actions en cours rejetées, un envoi en vol n’écrit plus rien', async () => {
    const { file, serveur, minuteurs, stockage } = monter({ reseau: false });
    await file.soumettre(ev.checkIn()).catch(() => undefined);
    expect(minuteurs.actifs()).toHaveLength(1);

    serveur.reseau = true;
    const enVol = file.soumettre(ev.kaye());
    file.vider();
    await stockage.toutEffacer();
    await expect(enVol).rejects.toMatchObject({ code: 'NON_AUTHENTIFIE' });
    await laisserFinir();
    expect(file.etat()).toMatchObject({ enAttente: 0, refus: [], blocage: null });
    expect(minuteurs.actifs()).toHaveLength(0);
    expect(await stockage.listerLignes()).toEqual([]);
  });
});
