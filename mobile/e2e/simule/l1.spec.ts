import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * L1-C sur l'export web SIMULÉ : retrait de la démo, créer un compte, profil en validation, préinscription,
 * « Je pars chez … » (accord, bandeau, positions arrondies, arrêts), check-in QR signé (VALIDE / À vérifier / refusé).
 * `SHOTS_DIR=/chemin` ajoute des captures 390 px.
 */
const SHOTS = process.env.SHOTS_DIR;
const QR_SIGNE = 'koudmen:domicile:s1:eyJhIjoiYWluZV9sZW9uaWUiLCJ2IjoxfQ.c2lnbmF0dXJlLXNpbXVsZWU';

type Journal = {
  inscriptions: { email: string; commune: string; dateNaissance: string }[];
  motsDePasseOublies: string[];
  trajets: { visiteId: string; action: string }[];
  positions: { latitude: number; longitude: number; precisionMetres: number }[];
  checkIns: { qr: boolean; code: boolean; position: boolean; simulee: boolean }[];
  orientations: { email: string; issue: string }[];
  demandesVerification: string[];
};

async function capture(page: Page, nom: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l1-${nom}.png`, fullPage: false });
}
async function centrer(l: Locator) {
  await l.evaluate((el) => el.scrollIntoView({ block: 'center' }));
}
const journal = (page: Page) => page.evaluate(() => (globalThis as { __KOUDMEN_API_JOURNAL__?: Journal }).__KOUDMEN_API_JOURNAL__);

async function scenario(page: Page, s: Record<string, unknown>) {
  await page.addInitScript((x) => {
    (globalThis as { __KOUDMEN_NATIF__?: unknown }).__KOUDMEN_NATIF__ = x;
  }, s);
}

async function connecter(page: Page, email = 'josiane@exemple.fr', motDePasse = 'koudmen') {
  await page.goto('/');
  await page.getByTestId('champ-email').fill(email);
  await page.getByTestId('champ-mot-de-passe').fill(motDePasse);
  await page.getByTestId('bouton-connexion').click();
}

test('connexion : plus de bouton ni d’identifiants de démonstration ; liens compte, famille, mot de passe', async ({ page }) => {
  await page.goto('/');
  const ecran = page.getByTestId('ecran-connexion');
  await expect(ecran).toBeVisible();
  await expect(page.getByTestId('bouton-demo')).toHaveCount(0);
  await expect(ecran).not.toContainText(/démo|démonstration|demo\.koudmen/i);
  await expect(page.getByTestId('bouton-creer-compte-accompagnant')).toBeVisible();
  await expect(page.getByTestId('lien-famille')).toContainText('Vous êtes une famille ?');
  await expect(page.getByTestId('bloc-creer-compte')).toContainText('gratuite');
  await centrer(page.getByTestId('bloc-creer-compte'));
  await capture(page, '01-connexion');

  await page.getByTestId('lien-mot-de-passe-oublie').click();
  await page.getByTestId('bouton-envoyer-lien').click();
  await expect(page.getByTestId('ecran-mot-de-passe-oublie')).toContainText('Entrez votre e-mail.');
  await page.getByTestId('champ-email-oubli').fill('inconnu@exemple.fr');
  await page.getByTestId('bouton-envoyer-lien').click();
  await expect(page.getByTestId('confirmation-mot-de-passe')).toContainText('Si un compte existe');
  expect((await journal(page))?.motsDePasseOublies).toEqual(['inconnu@exemple.fr']);
});

test('créer un compte : erreurs près des champs, puis « Vérifiez votre e-mail », puis profil en validation', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('bouton-creer-compte-accompagnant').click();
  await expect(page.getByTestId('inscription-gratuite')).toContainText('L’inscription est gratuite.');
  await page.getByTestId('bouton-creer-compte').click();
  await expect(page.getByText('Entrez votre prénom.')).toBeVisible();
  await expect(page.getByTestId('case-cgu-erreur')).toBeVisible();
  await capture(page, '02-inscription-erreurs');

  await page.getByTestId('champ-prenom').fill('Marius');
  await page.getByTestId('champ-nom').fill('Rosette');
  await page.getByTestId('champ-email-inscription').fill('marius@exemple.fr');
  await page.getByTestId('champ-telephone').fill('0696 12 34 56');
  await page.getByTestId('champ-date-naissance').fill('12082010');
  await expect(page.getByTestId('champ-date-naissance')).toHaveValue('12/08/2010');
  await page.getByTestId('champ-mot-de-passe-inscription').fill('soleil du matin');
  await page.getByTestId('choix-commune').click();
  await page.getByTestId('choix-commune-SAINTE_LUCE').click();
  await expect(page.getByTestId('choix-commune')).toContainText('Sainte-Luce');
  await page.getByTestId('case-cgu').click();
  await expect(page.getByTestId('case-cgu')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('lien-confidentialite')).toBeVisible();
  await page.getByTestId('bouton-creer-compte').click();
  await expect(page.getByText('Il faut avoir 18 ans ou plus pour devenir accompagnant.')).toBeVisible();

  await page.getByTestId('champ-date-naissance').fill('12/08/1988');
  await page.getByTestId('bouton-creer-compte').click();
  await expect(page.getByTestId('ecran-verifier-email')).toContainText('Vérifiez votre');
  await capture(page, '03-verifier-email');
  const j = await journal(page);
  expect(j?.inscriptions).toEqual([{ email: 'marius@exemple.fr', commune: 'SAINTE_LUCE', dateNaissance: '1988-08-12' }]);
  expect(JSON.stringify(j)).not.toContain('soleil du matin');

  await page.getByTestId('bouton-aller-connexion').click();
  await page.getByTestId('champ-email').fill('marius@exemple.fr');
  await page.getByTestId('champ-mot-de-passe').fill('soleil du matin');
  await page.getByTestId('bouton-connexion').click();
  const validation = page.getByTestId('ecran-validation');
  await expect(validation).toContainText('Profil en cours de');
  await expect(page.getByTestId('etapes-validation')).toContainText('Confirmer votre e-mail');
  // D15 (revue UX B3) : pas de promesse d'appel avant la demande de vérification.
  await expect(validation).not.toContainText(/vous appelle|nous vous appelons/i);
  await expect(page.getByTestId('bouton-orientation')).toBeVisible();
  await expect(page.getByTestId('contact-validation')).toContainText('@');
  await expect(page.getByTestId('ecran-visites')).toHaveCount(0);
  await capture(page, '04-profil-en-validation');
  await page.getByTestId('bouton-actualiser').click();
  await expect(page.getByTestId('info-validation')).toContainText('pas encore validé');
});

test('D15 : orientation en 5 questions puis demande de vérification, dans l’app', async ({ page }) => {
  await connecter(page, 'en-validation@exemple.fr');
  const validation = page.getByTestId('ecran-validation');
  await expect(page.getByTestId('etapes-validation')).toContainText('Mon statut en 5 questions');
  await expect(validation).not.toContainText(/vous appelle/i);
  await page.getByTestId('bouton-orientation').click();

  const q = page.getByTestId('orientation-question');
  await expect(q).toHaveText('Que voulez-vous faire ?');
  await expect(page.getByTestId('q1-LIEN')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('bouton-orientation-suivant').click();
  await expect(page.getByTestId('orientation-manque')).toContainText('Choisissez une réponse');
  await page.getByTestId('q1-PRESENCE').click();
  await capture(page, '04b-orientation-q1');
  await page.getByTestId('bouton-orientation-suivant').click();
  await expect(q).toHaveText('Voulez-vous être payé(e) ?');
  await page.getByTestId('q2-oui').click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await page.getByTestId('q3-AUCUN').click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await expect(q).toHaveText('Quelle est votre situation aujourd’hui ?');
  await page.getByTestId('q4-ETUDIANT').click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await page.getByTestId('q5-AUCUN').click();
  await page.getByTestId('bouton-orientation-suivant').click();

  const resultat = page.getByTestId('resultat-orientation');
  await expect(resultat).toContainText('Statut recommandé');
  await expect(resultat).toContainText('Payé par la famille, avec le CESU');
  await expect(resultat).toContainText('Étudiant');
  await capture(page, '04c-orientation-resultat');
  await page.getByTestId('bouton-orientation-continuer').click();

  await expect(page.getByTestId('etapes-validation')).toContainText('Payé par la famille, avec le CESU');
  // Avant l'envoi : les étapes ne disent pas « l'équipe vous appelle » (le bouton dit ce qui se passe après l'envoi).
  await expect(page.getByTestId('etapes-validation')).not.toContainText(/vous appelle/i);
  await expect(page.getByTestId('etapes-validation')).toContainText('À envoyer maintenant.');
  await page.getByTestId('bouton-demander-verification').click();
  await expect(page.getByTestId('etapes-validation')).toContainText('Demande envoyée.');
  await expect(page.getByTestId('etapes-validation')).toContainText('L’équipe vous appelle');
  await expect(page.getByTestId('texte-demande-envoyee')).toBeVisible();
  await capture(page, '04d-demande-envoyee');
  const j = await journal(page);
  expect(j?.orientations).toEqual([{ email: 'en-validation@exemple.fr', issue: 'RECOMMANDE' }]);
  expect(j?.demandesVerification).toEqual(['en-validation@exemple.fr']);
});

test('préinscription : écran calme à la place des visites ; e-mail non vérifié : rappel', async ({ page }) => {
  // Revue UX M14 : profil à valider en préinscription → même parcours de validation, avec « ouvre bientôt ».
  await connecter(page, 'preinscription-validation@exemple.fr');
  await expect(page.getByTestId('encadre-preinscription')).toContainText('Koudmen ouvre bientôt en Martinique');
  await expect(page.getByTestId('bouton-orientation')).toBeVisible();
  await page.getByTestId('bouton-deconnexion-validation').click();

  await connecter(page, 'preinscription@exemple.fr');
  await expect(page.getByTestId('ecran-bientot')).toContainText('Koudmen ouvre bientôt');
  await expect(page.getByTestId('ecran-bientot')).toContainText('Votre profil est validé');
  await expect(page.getByTestId('ecran-visites')).toHaveCount(0);
  await capture(page, '05-bientot');
  await page.getByTestId('bouton-deconnexion-bientot').click();

  await connecter(page, 'email-a-verifier@exemple.fr');
  await expect(page.getByTestId('rappel-email')).toContainText('Vérifiez votre e-mail');
});

test('« Je pars chez Léonie » : accord avant le 1er partage, bandeau, positions arrondies, arrêt à l’arrivée', async ({ page }) => {
  await scenario(page, { intervalleSuiviMs: 300, ecartEnvoiMs: 600 });
  await connecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await centrer(page.getByTestId('carte-sur-la-route'));
  await page.getByTestId('bouton-je-pars').click();

  const accord = page.getByTestId('ecran-accord-trajet');
  await expect(accord).toContainText('arrondie à environ 100 m');
  await expect(accord).toContainText('toutes les 30 secondes');
  await expect(accord).toContainText('La famille qui vous emploie');
  await expect(accord).toContainText('60 minutes');
  await expect(accord).toContainText('Pas d’historique');
  await expect(accord).toContainText('aucun effet sur vos missions');
  await capture(page, '06-accord-trajet');
  await page.getByTestId('bouton-accepter-trajet').click();

  await expect(page.getByTestId('bandeau-trajet')).toContainText('Trajet partagé');
  await expect(page.getByTestId('trajet-en-cours')).toBeVisible();
  await capture(page, '07-trajet-en-cours');
  // Bandeau persistant : visible aussi sur la carte de l'itinéraire.
  await page.getByTestId('bandeau-trajet-carte').click();
  await expect(page.getByTestId('ecran-itineraire')).toBeVisible();
  await expect(page.getByTestId('plan-schematique')).toBeVisible();
  await expect(page.getByTestId('bouton-ouvrir-plans')).toContainText('Google Maps');
  await capture(page, '08-itineraire');

  // Le trajet simulé arrive à moins de 150 m : arrêt tout seul.
  await expect(page.getByTestId('bandeau-trajet')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(async () => (await journal(page))?.trajets.map((t) => t.action)).toEqual(['DEMARRER', 'ARRETER']);
  const j = await journal(page);
  expect(j!.positions.length).toBeGreaterThan(0);
  for (const p of j!.positions) {
    expect(Math.round(p.latitude * 1000) / 1000).toBe(p.latitude);
    expect(Math.round(p.longitude * 1000) / 1000).toBe(p.longitude);
    expect(p.precisionMetres).toBeGreaterThanOrEqual(100);
  }
  const ecarts = await page.evaluate(() => (globalThis as { __KOUDMEN_NATIF_JOURNAL__?: { suivisDemarres: number; suivisArretes: number } }).__KOUDMEN_NATIF_JOURNAL__);
  expect(ecarts).toMatchObject({ suivisDemarres: 1, suivisArretes: 1 });
});

test('trajet : accord mémorisé (pas de 2e écran), arrêt manuel, accord retiré dans Profil', async ({ page }) => {
  await scenario(page, { intervalleSuiviMs: 60_000, ecartEnvoiMs: 600 });
  await connecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await page.getByTestId('bouton-je-pars').click();
  await page.getByTestId('bouton-accepter-trajet').click();
  await expect(page.getByTestId('bandeau-trajet')).toBeVisible();
  await page.getByTestId('bandeau-trajet-arreter').click();
  await expect(page.getByTestId('bandeau-trajet')).toHaveCount(0);
  await expect(page.getByTestId('fin-trajet')).toContainText('Partage arrêté');

  // 2e départ : pas d'écran d'accord.
  await page.getByTestId('bouton-je-pars').click();
  await expect(page.getByTestId('bandeau-trajet')).toBeVisible();
  await expect(page.getByTestId('ecran-accord-trajet')).toHaveCount(0);
  await page.getByTestId('bouton-arreter-trajet').click();

  await page.getByTestId('bouton-retour-fiche').click();
  await page.getByTestId('onglet-profil').click();
  await centrer(page.getByTestId('retirer-accord-trajet'));
  await page.getByTestId('retirer-accord-trajet').click();
  await expect(page.getByTestId('lire-accord-trajet')).toBeVisible();
});

test('trajet : permission refusée → message, rien ne part ; « Non merci » ne démarre rien', async ({ page }) => {
  await scenario(page, { suivi: 'refusee' });
  await connecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await page.getByTestId('bouton-je-pars').click();
  await page.getByTestId('bouton-refuser-trajet').click();
  await expect(page.getByTestId('carte-sur-la-route')).toBeVisible();
  expect((await journal(page))?.trajets ?? []).toEqual([]);

  await page.getByTestId('bouton-je-pars').click();
  await page.getByTestId('bouton-accepter-trajet').click();
  await expect(page.getByTestId('erreur-accord-trajet')).toContainText('refusé l’accès à la position');
  await expect(page.getByTestId('bandeau-trajet')).toHaveCount(0);
  expect((await journal(page))?.positions).toEqual([]);
});

async function scannerQr(page: Page) {
  await page.getByTestId('bouton-scanner').click();
  await page.getByTestId('lire-qr-simule').click();
  await expect(page.getByTestId('qr-signe-lu')).toBeVisible();
}

test('check-in QR signé + position proche : « Arrivée validée », sans coordonnées gardées à l’écran', async ({ page }) => {
  await scenario(page, { camera: 'accordee', qr: QR_SIGNE });
  await connecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await scannerQr(page);
  await page.getByTestId('accord-position').click();
  await centrer(page.getByTestId('carte-arrivee'));
  await capture(page, '09-qr-signe-lu');
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('controle-VALIDE')).toContainText('Arrivée validée');
  await expect(page.getByTestId('raison-controle')).toContainText('moins de 150 m');
  await centrer(page.getByTestId('controle-VALIDE'));
  await capture(page, '10-controle-valide');
  const j = await journal(page);
  expect(j?.checkIns).toEqual([{ visiteId: 'vis_leonie_j0', qr: true, code: false, position: true, simulee: false }]);
  expect(await page.getByTestId('ecran-fiche-visite').innerText()).not.toMatch(/14[.,]6/);
});

test('check-in QR signé + position simulée (mocked) : « À vérifier » avec la raison', async ({ page }) => {
  await scenario(page, { camera: 'accordee', qr: QR_SIGNE, mocked: true });
  await connecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await scannerQr(page);
  await page.getByTestId('accord-position').click();
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('controle-A_VERIFIER')).toContainText('position simulée');
  await capture(page, '11-controle-a-verifier');
  expect((await journal(page))?.checkIns[0]).toMatchObject({ qr: true, position: true, simulee: true });
});

test('check-in carte révoquée : refus clair, puis code à 6 caractères en secours', async ({ page }) => {
  await scenario(page, { camera: 'accordee', qr: `${QR_SIGNE}.revoque` });
  await connecter(page);
  await page.getByTestId('ouvrir-visite-vedette').click();
  await scannerQr(page);
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('controle-REFUSE')).toContainText('plus valable');
  await expect(page.getByTestId('qr-signe-lu')).toHaveCount(0);
  await capture(page, '12-controle-refuse');
  await page.getByTestId('champ-code-domicile').fill('lkw7q3');
  await page.getByTestId('bouton-arrivee').click();
  await expect(page.getByTestId('retour-arrivee')).toContainText('Code du domicile');
  await expect(page.getByTestId('controle-REFUSE')).toHaveCount(0);
});
