import { expect, test } from '@playwright/test';
import { dossierVerificationSchema, type ElementVerification } from '../../contracts';
import {
  aFaire,
  appelPropose,
  codeComplet,
  controlerFichier,
  copieEnCache,
  ecranItem,
  formaterSiret,
  formaterTelephone,
  libelleEtat,
  luhnValide,
  nettoyerCode,
  normaliserSiret,
  normaliserTelephone,
  prochainItem,
  secondesAvantRenvoi,
  trierItems,
} from '../verifications';

/** L2 : parcours de vérification dans l'app (module pur). */

test('téléphone T1 : Guadeloupe d’abord (+590 690, +590 691, fixe +590 590), exemple du territoire', () => {
  expect(normaliserTelephone('0690 12 34 56')).toEqual({ e164: '+590690123456', genre: 'mobile' });
  expect(normaliserTelephone('0691 12 34 56')).toEqual({ e164: '+590691123456', genre: 'mobile' });
  expect(normaliserTelephone('+590 691 12 34 56')).toEqual({ e164: '+590691123456', genre: 'mobile' });
  expect(normaliserTelephone('0590 12 34 56')).toEqual({ e164: '+590590123456', genre: 'fixe' });
  expect(normaliserTelephone('+590590123456')).toEqual({ e164: '+590590123456', genre: 'fixe' });
  // Guyane, Hexagone.
  expect(normaliserTelephone('0694 12 34 56')).toEqual({ e164: '+594694123456', genre: 'mobile' });
  expect(normaliserTelephone('0594 12 34 56')).toEqual({ e164: '+594594123456', genre: 'fixe' });
  expect(normaliserTelephone('07 12 34 56 78')).toEqual({ e164: '+33712345678', genre: 'mobile' });
  expect(normaliserTelephone('01 23 45 67 89')).toEqual({ e164: '+33123456789', genre: 'fixe' });
  // Aide : exemple de Guadeloupe par défaut, exemple du territoire choisi sinon.
  expect(normaliserTelephone('0690 12')).toMatchObject({ erreur: 'Ce numéro n’est pas complet. Exemple : 0690 12 34 56.' });
  expect(normaliserTelephone('06 12', '06 12 34 56 78')).toMatchObject({ erreur: 'Ce numéro n’est pas complet. Exemple : 06 12 34 56 78.' });
  expect(normaliserTelephone('+44 7700 900123')).toMatchObject({ erreur: expect.stringContaining('Guadeloupe') });
  expect(formaterTelephone('+590690123456')).toBe('+590 690 12 34 56');
  expect(formaterTelephone('+590590123456')).toBe('+590 590 12 34 56');
  expect(formaterTelephone('+594694123456')).toBe('+594 694 12 34 56');
});

test('téléphone : formats des Antilles, de la diaspora, préfixes refusés', () => {
  expect(normaliserTelephone('0696 12 34 56')).toEqual({ e164: '+596696123456', genre: 'mobile' });
  expect(normaliserTelephone('+596 697 12 34 56')).toEqual({ e164: '+596697123456', genre: 'mobile' });
  expect(normaliserTelephone('00590 690 12 34 56')).toEqual({ e164: '+590690123456', genre: 'mobile' });
  expect(normaliserTelephone('06 12 34 56 78')).toEqual({ e164: '+33612345678', genre: 'mobile' });
  // Fixe : pas de SMS, appel vocal.
  expect(normaliserTelephone('0596 12 34 56')).toEqual({ e164: '+596596123456', genre: 'fixe' });
  expect(normaliserTelephone('0596 12 34')).toMatchObject({ erreur: expect.stringContaining('pas complet') });
  expect(normaliserTelephone('+44 7700 900123')).toMatchObject({ erreur: expect.stringContaining('Martinique') });
  expect(normaliserTelephone('')).toMatchObject({ erreur: 'Entrez votre numéro de téléphone.' });
  expect(formaterTelephone('+596696123456')).toBe('+596 696 12 34 56');
  expect(formaterTelephone('+33612345678')).toBe('+33 6 12 34 56 78');
});

test('code : 6 chiffres, collage nettoyé ; renvoi après le délai ; appel en repli', () => {
  expect(nettoyerCode('Votre code : 123 456.')).toBe('123456');
  expect(nettoyerCode('1234567')).toBe('123456');
  expect(codeComplet('12345')).toBe(false);
  expect(codeComplet('123456')).toBe(true);
  const t0 = Date.parse('2026-10-08T10:00:00Z');
  expect(secondesAvantRenvoi('2026-10-08T10:01:00Z', t0)).toBe(60);
  expect(secondesAvantRenvoi('2026-10-08T10:01:00Z', t0 + 59_500)).toBe(1);
  expect(secondesAvantRenvoi('2026-10-08T10:01:00Z', t0 + 61_000)).toBe(0);
  expect(secondesAvantRenvoi(null, t0)).toBe(0);
  expect(appelPropose('mobile', false)).toBe(false);
  expect(appelPropose('mobile', true)).toBe(true);
  expect(appelPropose('fixe', false)).toBe(true);
});

test('SIRET : 14 chiffres, clé de Luhn, SIREN reconnu', () => {
  expect(luhnValide('90100000000009')).toBe(true);
  expect(normaliserSiret('901 000 000 00009')).toEqual({ siret: '90100000000009' });
  expect(normaliserSiret('90100000000008')).toMatchObject({ erreur: expect.stringContaining('pas valable') });
  expect(normaliserSiret('901000000')).toMatchObject({ erreur: expect.stringContaining('SIREN') });
  expect(normaliserSiret('9010')).toMatchObject({ erreur: 'Le SIRET a 14 chiffres. Vous en avez entré 4.' });
  expect(normaliserSiret('ABC')).toMatchObject({ erreur: 'Le SIRET contient seulement des chiffres.' });
  expect(formaterSiret('90100000000009')).toBe('901 000 000 00009');
});

test('documents : PDF, JPEG, PNG ; 5 Mo au plus (contrat serveur)', () => {
  expect(controlerFichier({ nom: 'facture.pdf', type: 'application/pdf', taille: 200_000 })).toBeNull();
  expect(controlerFichier({ nom: 'photo.jpg', type: '', taille: 1_000_000 })).toBeNull();
  expect(controlerFichier({ nom: 'photo.heic', type: 'image/heic', taille: 1_000 })).toContain('pas accepté');
  expect(controlerFichier({ nom: 'gros.pdf', type: 'application/pdf', taille: 6 * 1024 * 1024 })).toContain('5 Mo');
});

const el = (p: Partial<ElementVerification> & Pick<ElementVerification, 'type'>): ElementVerification => ({
  id: `el${p.type.toLowerCase().replace(/_/g, '')}`,
  etat: 'A_FOURNIR',
  methode: null,
  obligatoire: true,
  libelle: p.type,
  expireLe: null,
  actionSuivante: 'AUCUNE',
  motifComplement: null,
  surLeSite: false,
  message: '',
  ...p,
});

test('éléments : écran choisi sur actionSuivante, ordre du parcours, prochain à faire', () => {
  expect(ecranItem(el({ type: 'ADRESSE', actionSuivante: 'TELEVERSER_JUSTIFICATIF' }))).toBe('/dossier/adresse');
  expect(ecranItem(el({ type: 'ENTREPRISE', actionSuivante: 'TELEVERSER_DOCUMENT_ENTREPRISE' }))).toBe('/dossier/entreprise');
  expect(ecranItem(el({ type: 'CASIER_B3', actionSuivante: 'MONTRER_EN_VISIO' }))).toBeNull();
  expect(ecranItem(el({ type: 'REFERENCES', actionSuivante: 'DECLARER_SUR_LE_SITE', surLeSite: true }))).toBeNull();
  // En attente : l'écran s'ouvre pour lire l'état.
  expect(ecranItem(el({ type: 'IDENTITE', etat: 'EN_COURS', actionSuivante: 'ATTENDRE' }))).toBe('/dossier/identite');

  const items = [
    el({ type: 'CASIER_B3', etat: 'DECLARE', actionSuivante: 'MONTRER_EN_VISIO' }),
    el({ type: 'ADRESSE', actionSuivante: 'SAISIR_ADRESSE' }),
    el({ type: 'IDENTITE', actionSuivante: 'VERIFIER_IDENTITE' }),
    el({ type: 'TELEPHONE', etat: 'VALIDE', actionSuivante: 'AUCUNE' }),
  ];
  const { app, autres } = trierItems({ items });
  expect(app.map((i) => i.type)).toEqual(['TELEPHONE', 'IDENTITE', 'ADRESSE']);
  expect(autres.map((i) => i.type)).toEqual(['CASIER_B3']);
  expect(prochainItem({ items })?.type).toBe('IDENTITE');
  expect(aFaire(el({ type: 'IDENTITE', etat: 'A_FOURNIR', actionSuivante: 'ATTENDRE' }))).toBe(false);
});

test('libellés : neutres, jamais « échec » ; un refus du prestataire = relu par l’équipe', () => {
  const etats = ['A_FOURNIR', 'EN_COURS', 'DECLARE', 'A_REVOIR', 'VALIDE', 'REFUSE', 'EXPIRE'] as const;
  for (const etat of etats) for (const type of ['TELEPHONE', 'IDENTITE', 'ADRESSE', 'ENTREPRISE'] as const) {
    expect(libelleEtat({ type, etat, methode: null })).not.toMatch(/échec|échoué|rejet/i);
  }
  expect(libelleEtat({ type: 'IDENTITE', etat: 'A_REVOIR', methode: 'AUTO_PRESTATAIRE' })).toBe('Relu par l’équipe');
  expect(libelleEtat({ type: 'ADRESSE', etat: 'VALIDE', methode: 'AUTO_REGISTRE' })).toBe('Fait (adresse du siège)');
});

test('contrat serveur : dossier strict, sans image ni donnée en trop', () => {
  const dossier = {
    dossier: { etat: 'BROUILLON', motif: null, recoursPossible: false },
    items: [el({ type: 'TELEPHONE', actionSuivante: 'VERIFIER_TELEPHONE' })],
    peutSoumettre: false,
    manque: ['Mon téléphone'],
    sessionsIdentiteRestantes: 3,
    telephoneMasque: null,
  };
  expect(dossierVerificationSchema.safeParse(dossier).success).toBe(true);
  expect(dossierVerificationSchema.safeParse({ ...dossier, photo: 'data:image/jpeg;base64,AAAA' }).success).toBe(false);
});

test('L2b (revue m6) : seule la copie dans le cache de l’app est effacée après l’envoi', () => {
  const cache = 'file:///data/user/0/fr.koudmen/cache/';
  expect(copieEnCache(`${cache}DocumentPicker/abc.pdf`, cache)).toBe(true);
  expect(copieEnCache(`${cache}ImagePicker/photo.jpg`, cache.slice(0, -1))).toBe(true);
  // Jamais l'original (galerie, dossier, autre app), jamais une sortie du cache.
  expect(copieEnCache('content://media/external/images/media/12', cache)).toBe(false);
  expect(copieEnCache('file:///storage/emulated/0/DCIM/photo.jpg', cache)).toBe(false);
  expect(copieEnCache(`${cache}../files/secret.db`, cache)).toBe(false);
  expect(copieEnCache(`${cache}%2e%2e/files/secret.db`, cache)).toBe(false);
  expect(copieEnCache(cache, cache)).toBe(false);
  expect(copieEnCache(`${cache}a.pdf`, null)).toBe(false);
});
