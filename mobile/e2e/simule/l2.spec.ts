import { expect, test, type Page } from '@playwright/test';

/**
 * L2 sur l'export web SIMULÉ : vérification de l'accompagnant dans l'app, après l'orientation.
 * Téléphone (code, renvoi, appel), identité (page simulée du prestataire, visio), entreprise (SIRET), adresse
 * (justificatif), puis demande de vérification. `SHOTS_DIR=/chemin` ajoute des captures 390 px.
 */
const SHOTS = process.env.SHOTS_DIR;
// Parcours complets (4 écrans, délai de renvoi réel de quelques secondes).
test.describe.configure({ timeout: 90_000 });

type Journal = {
  codesTelephone: { canal: string; fin: string }[];
  confirmationsTelephone: number;
  sessionsIdentite: number;
  decisionsIdentite: string[];
  visios: string[];
  adresses: number;
  entreprises: string[];
  documents: { type: string; mime: string; taille: number | null }[];
  soumissions: string[];
};
const journal = (page: Page) => page.evaluate(() => (globalThis as { __KOUDMEN_API_JOURNAL__?: Journal }).__KOUDMEN_API_JOURNAL__);
async function capture(page: Page, nom: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l2-${nom}.png`, fullPage: false });
}

/** PNG 1 × 1 (aucune donnée personnelle). */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function connecterEtOrienter(page: Page, email: string, reponses: { q1: string; q3: string }) {
  // Délai de renvoi court pour le test (60 s en vrai).
  await page.addInitScript(() => {
    (globalThis as { __KOUDMEN_VERIF__?: unknown }).__KOUDMEN_VERIF__ = { delaiRenvoiS: 6 };
  });
  await page.goto('/');
  await page.getByTestId('champ-email').fill(email);
  await page.getByTestId('champ-mot-de-passe').fill('koudmen');
  await page.getByTestId('bouton-connexion').click();
  await page.getByTestId('bouton-orientation').click();
  await page.getByTestId(`q1-${reponses.q1}`).click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await page.getByTestId('q2-oui').click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await page.getByTestId(`q3-${reponses.q3}`).click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await page.getByTestId('q5-AUCUN').click();
  await page.getByTestId('bouton-orientation-suivant').click();
  await expect(page.getByTestId('resultat-orientation')).toContainText('Statut recommandé');
  await page.getByTestId('bouton-orientation-continuer').click();
  await expect(page.getByTestId('mes-verifications')).toBeVisible();
}

test('L2 salarié CESU : téléphone, identité, adresse, puis demande ; jamais de photo de pièce dans l’app', async ({ page }) => {
  await connecterEtOrienter(page, 'en-validation@exemple.fr', { q1: 'PRESENCE', q3: 'AUCUN' });
  const carte = page.getByTestId('mes-verifications');
  await expect(carte).toContainText('Koudmen garde le résultat, jamais la photo de votre pièce');
  await expect(carte).toContainText('Mon téléphone');
  await expect(carte).toContainText('Mon adresse');
  await expect(carte).not.toContainText('Mon entreprise');
  await expect(page.getByTestId('mes-verifications-autres')).toContainText('pendant la visio');
  await expect(page.getByTestId('etapes-validation')).not.toContainText(/vous appelle/i);
  await capture(page, '01-mes-verifications');

  // ─── Téléphone ───
  await page.getByTestId('bouton-prochaine-verification').click();
  await expect(page.getByTestId('pourquoi-telephone')).toContainText('Le code reçu par SMS');
  await page.getByTestId('champ-telephone').fill('+44 7700 900123');
  await page.getByTestId('bouton-envoyer-code').click();
  await expect(page.getByTestId('ecran-telephone')).toContainText('Antilles');
  await page.getByTestId('champ-telephone').fill('0690 12 34 56');
  await page.getByTestId('bouton-envoyer-code').click();
  await expect(page.getByTestId('code-envoye')).toContainText('+590 690 12 34 56');
  const champCode = page.getByTestId('champ-code');
  await expect(champCode).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(champCode).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByTestId('delai-renvoi')).toContainText('Nouvel envoi possible dans');
  await page.getByTestId('bouton-renvoyer-code').click();
  await expect(page.getByTestId('delai-renvoi')).toContainText(/Nouvel envoi possible dans \d+ s/);
  await expect(page.getByTestId('champ-code')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByTestId('bouton-appel-vocal')).toHaveCount(0);
  await capture(page, '02-code');
  await champCode.fill('111111');
  await page.getByTestId('bouton-confirmer-code').click();
  await expect(page.getByTestId('ecran-telephone')).toContainText('Il reste 4 essais');
  // Après le délai : renvoi, puis « Recevoir un appel » (2 SMS).
  await expect(page.getByTestId('delai-renvoi')).toContainText('Demandez un nouvel envoi', { timeout: 10_000 });
  await page.getByTestId('bouton-renvoyer-code').click();
  await expect(page.getByTestId('bouton-appel-vocal')).toBeVisible();
  await champCode.fill('Votre code : 000 000');
  await expect(champCode).toHaveValue('000000');
  await page.getByTestId('bouton-confirmer-code').click();
  await expect(page.getByTestId('telephone-valide')).toContainText('+590 690 •• •• 56');
  await page.getByTestId('bouton-telephone-retour').click();
  await expect(page.getByTestId('mes-verifications-TELEPHONE')).toContainText('Fait');

  // ─── Identité ───
  await page.getByTestId('bouton-prochaine-verification').click();
  const info = page.getByTestId('information-identite');
  await expect(info).toContainText('Veriff');
  await expect(info).toContainText('Koudmen ne garde jamais les photos');
  await expect(info).toContainText('30 jours');
  await expect(info).toContainText('visio');
  await capture(page, '03-identite');
  await page.getByTestId('bouton-commencer-identite').click();
  await expect(page.getByTestId('case-accord-biometrie-erreur')).toContainText('Cochez la case');
  await page.getByTestId('case-accord-biometrie').click();
  await page.getByTestId('bouton-commencer-identite').click();
  // Mode simulé : page de test à la place du prestataire. « Photo à reprendre », puis « confirmée ».
  await page.getByTestId('simulee-A_REPRENDRE').click();
  await expect(page.getByTestId('etat-identite-complement')).toContainText('Recommencez avec une photo nette');
  await expect(page.getByTestId('essais-restants')).toContainText('Il reste 2 essais');
  await page.getByTestId('bouton-commencer-identite').click();
  await page.getByTestId('simulee-APPROUVE').click();
  await expect(page.getByTestId('etat-identite-badge')).toContainText('Fait');
  await page.getByTestId('bouton-identite-retour').click();
  await expect(page.getByTestId('mes-verifications-IDENTITE')).toContainText('Fait');

  // ─── Adresse ───
  await page.getByTestId('bouton-prochaine-verification').click();
  await page.getByTestId('bouton-declarer-adresse').click();
  await expect(page.getByTestId('ecran-adresse')).toContainText('Le code postal a 5 chiffres');
  await page.getByTestId('champ-adresse-ligne').fill('12 rue des Flamboyants');
  await page.getByTestId('champ-adresse-cp').fill('97110');
  await page.getByTestId('champ-adresse-commune').fill('Pointe-à-Pitre');
  await page.getByTestId('bouton-declarer-adresse').click();
  await expect(page.getByTestId('document-adresse')).toContainText('Justificatif de domicile');
  await page.getByTestId('document-adresse-type-JUSTIFICATIF_DOMICILE').click();
  const choix = page.waitForEvent('filechooser');
  await page.getByTestId('document-adresse-galerie').click();
  await (await choix).setFiles({ name: 'facture-edf.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('document-adresse-apercu')).toContainText('facture-edf.png');
  await capture(page, '04-justificatif');
  await page.getByTestId('document-adresse-envoyer').click();
  await expect(page.getByTestId('etat-adresse-badge')).toContainText('En revue par l’équipe');
  await expect(page.getByTestId('pourquoi-adresse')).toContainText('30 jours');
  await page.getByTestId('bouton-adresse-retour').click();

  // ─── Demande ───
  await expect(page.getByTestId('bouton-prochaine-verification')).toHaveCount(0);
  await page.getByTestId('bouton-demander-verification').click();
  await expect(page.getByTestId('etapes-validation')).toContainText('Demande envoyée.');
  await expect(page.getByTestId('etapes-validation')).toContainText('L’équipe vous appelle');
  await capture(page, '05-demande-envoyee');

  const j = await journal(page);
  expect(j?.codesTelephone).toEqual([
    { canal: 'SMS', fin: '3456' },
    { canal: 'SMS', fin: '3456' },
  ]);
  expect(j?.decisionsIdentite).toEqual(['A_REPRENDRE', 'APPROUVE']);
  // Le fichier part au serveur ; l'app n'en garde ni le contenu ni le nom.
  expect(j?.documents).toEqual([{ type: 'JUSTIFICATIF_DOMICILE', mime: 'image/png', taille: PNG.length }]);
  expect(j?.soumissions).toEqual(['en-validation@exemple.fr']);
  const stockage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stockage).not.toContain('facture-edf');
  expect(stockage).not.toContain('0690');
});

test('L2 micro-entreprise : SIRET contrôlé, adresse du siège ; identité en visio', async ({ page }) => {
  await connecterEtOrienter(page, 'en-validation@exemple.fr', { q1: 'COUPS_DE_MAIN', q3: 'AUTO_ENTREPRENEUR_SAP' });
  await expect(page.getByTestId('mes-verifications')).toContainText('Mon entreprise (SIRET)');

  await page.getByTestId('mes-verifications-ENTREPRISE').click();
  await page.getByTestId('champ-siret').fill('901000000');
  await page.getByTestId('bouton-verifier-siret').click();
  await expect(page.getByTestId('ecran-entreprise')).toContainText('c’est le SIREN');
  await page.getByTestId('champ-siret').fill('901 000 000 00008');
  await page.getByTestId('bouton-verifier-siret').click();
  await expect(page.getByTestId('ecran-entreprise')).toContainText('n’est pas valable');
  // Nom caché au registre : un document est demandé (avis Sirene, RNE ou Kbis).
  await page.getByTestId('champ-siret').fill('903 000 000 00005');
  await page.getByTestId('bouton-verifier-siret').click();
  await expect(page.getByTestId('resultat-entreprise')).toContainText('cache le nom');
  await expect(page.getByTestId('document-entreprise')).toContainText('Avis de situation Sirene');
  await capture(page, '06-entreprise-document');
  await page.getByTestId('bouton-retour').click();

  // Identité : repli humain, sans biométrie.
  await page.getByTestId('mes-verifications-IDENTITE').click();
  await page.getByTestId('bouton-preferer-visio').click();
  await page.getByTestId('bouton-demander-visio').click();
  await expect(page.getByTestId('erreur-visio')).toContainText('moment de la journée');
  await page.getByTestId('creneau-visio-MATIN').click();
  await page.getByTestId('raison-visio-REFUS_BIOMETRIE').click();
  await page.getByTestId('bouton-demander-visio').click();
  await expect(page.getByTestId('etat-identite-badge')).toContainText('Visio demandée');

  const j = await journal(page);
  expect(j?.entreprises).toEqual(['90300000000005']);
  expect(j?.visios).toEqual(['MATIN:REFUS_BIOMETRIE']);
  expect(j?.sessionsIdentite).toBe(0);
});

test('L2 micro-entreprise : siège = adresse déclarée → adresse faite sans justificatif', async ({ page }) => {
  await connecterEtOrienter(page, 'en-validation@exemple.fr', { q1: 'COUPS_DE_MAIN', q3: 'AUTO_ENTREPRENEUR_SAP' });
  await page.getByTestId('mes-verifications-ENTREPRISE').click();
  await page.getByTestId('champ-siret').fill('90100000000009');
  await page.getByTestId('bouton-verifier-siret').click();
  await expect(page.getByTestId('resultat-entreprise')).toContainText('pas de justificatif');
  await page.getByTestId('bouton-entreprise-retour').click();
  await expect(page.getByTestId('mes-verifications-ADRESSE')).toContainText('Fait (adresse du siège)');
  await expect(page.getByTestId('mes-verifications-ENTREPRISE')).toContainText('Fait');
});
