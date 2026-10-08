import { expect, test } from '@playwright/test';
import { demandeEvenementsSchema, demandeInscriptionSchema, reponseMoiSchema } from '../../contracts';
import { lireControle } from '../../api/l1';
import { heureTexte, horsFuseauMartinique, libelleJour, memeJour, plageAvecFuseau } from '../../lib/format';
import { lienItineraire } from '../../lib/geo';
import { emailAVerifier, etatCompte } from '../../session/compte';
import { CHAMPS_VIDES, dateVersIso, formaterSaisieDate, validerInscription } from '../formulaire';

/** L1 : formulaire d'inscription, contrats serveur synchronisés (D13), état du compte, lien d'itinéraire (modules purs). */

const AUJOURDHUI = new Date('2026-10-07T12:00:00Z');
const OK = {
  ...CHAMPS_VIDES,
  prenom: ' Josiane ',
  nom: 'Mathurin',
  email: 'Josiane@Exemple.fr',
  telephone: '0696 12 34 56',
  dateNaissance: '05/03/1990',
  motDePasse: 'une phrase longue',
  commune: 'FORT_DE_FRANCE',
  accepteCgu: true,
};

test('saisie de la date : barres automatiques, dates impossibles refusées', () => {
  expect(formaterSaisieDate('05031990')).toBe('05/03/1990');
  expect(formaterSaisieDate('0503')).toBe('05/03');
  expect(formaterSaisieDate('05/03/19901')).toBe('05/03/1990');
  expect(dateVersIso('05/03/1990')).toBe('1990-03-05');
  expect(dateVersIso('31/02/1990')).toBeNull();
  expect(dateVersIso('5/3/1990')).toBeNull();
});

test('inscription valide : demande conforme au contrat (sans case confidentialité)', () => {
  const r = validerInscription(OK, AUJOURDHUI);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.demande).toEqual({
    prenom: 'Josiane',
    nom: 'Mathurin',
    email: 'josiane@exemple.fr',
    telephone: '0696 12 34 56',
    dateNaissance: '1990-03-05',
    motDePasse: 'une phrase longue',
    commune: 'FORT_DE_FRANCE',
    accepteCgu: true,
  });
  expect(demandeInscriptionSchema.safeParse({ role: 'ACCOMPAGNANT', ...r.demande }).success).toBe(true);
  // Décision de l'orchestrateur : la politique de confidentialité est un lien, pas une case.
  expect(demandeInscriptionSchema.safeParse({ role: 'ACCOMPAGNANT', ...r.demande, accepteConfidentialite: true }).success).toBe(false);
});

test('inscription : chaque manque est dit près du champ', () => {
  const r = validerInscription(CHAMPS_VIDES, AUJOURDHUI);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(Object.keys(r.erreurs).sort()).toEqual(['accepteCgu', 'commune', 'dateNaissance', 'email', 'motDePasse', 'nom', 'prenom', 'telephone']);
});

test('inscription : 18 ans minimum, 10 caractères minimum, téléphone de 10 chiffres', () => {
  const mineur = validerInscription({ ...OK, dateNaissance: '08/10/2008' }, AUJOURDHUI);
  expect(!mineur.ok && mineur.erreurs.dateNaissance).toContain('18 ans');
  const majeurDuJour = validerInscription({ ...OK, dateNaissance: '07/10/2008' }, AUJOURDHUI);
  expect(majeurDuJour.ok).toBe(true);
  const court = validerInscription({ ...OK, motDePasse: 'koudmen' }, AUJOURDHUI);
  expect(!court.ok && court.erreurs.motDePasse).toContain('Encore 3');
  const tel = validerInscription({ ...OK, telephone: '0696 12' }, AUJOURDHUI);
  expect(!tel.ok && tel.erreurs.telephone).toBeTruthy();
  const commune = validerInscription({ ...OK, commune: 'PARIS' }, AUJOURDHUI);
  expect(!commune.ok && commune.erreurs.commune).toBeTruthy();
});

test('GET /me : contrat serveur strict ; état du compte et rappel e-mail', () => {
  const base = { id: 'u1', role: 'ACCOMPAGNANT', prenom: 'J', nom: 'M', email: 'j@exemple.fr', demo: false, bacASable: false };
  const l1 = { ...base, emailVerifie: false, profilValide: false, preinscription: false };
  expect(reponseMoiSchema.safeParse(l1).success).toBe(true);
  // RGPD : liste fermée. Un champ en plus ou un champ L1 absent est refusé (versions différentes).
  expect(reponseMoiSchema.safeParse({ ...l1, champFutur: 1 }).success).toBe(false);
  expect(reponseMoiSchema.safeParse(base).success).toBe(false);
  expect(etatCompte({})).toBe('actif');
  expect(etatCompte({ profilValide: false })).toBe('validation');
  expect(etatCompte({ profilValide: false, preinscription: true })).toBe('validation');
  expect(etatCompte({ profilValide: true, preinscription: true })).toBe('preinscription');
  expect(emailAVerifier({})).toBe(false);
  expect(emailAVerifier({ emailVerifie: false })).toBe(true);
});

test('CHECK_IN L1 : qr signé + position (consentement, simulee) ; contrôle du serveur', () => {
  const ev = {
    type: 'CHECK_IN',
    visiteId: 'vis_1',
    clientEventId: '6f1c7a52-3b0e-4b8a-9d1e-0c2f4a6b8c10',
    survenuA: '2026-10-07T14:00:00.000Z',
    qr: 'koudmen:domicile:s1:eyJhIjoiYSJ9.c2ln',
    position: { latitude: 14.6, longitude: -61.07, precisionMetres: 12, consentement: true, simulee: false },
  };
  expect(demandeEvenementsSchema.safeParse({ evenements: [ev] }).success).toBe(true);
  expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...ev, champFutur: 1 }] }).success).toBe(false);
  const { qr: _qr, position: _p, ...vide } = ev;
  expect(demandeEvenementsSchema.safeParse({ evenements: [vide] }).success).toBe(false);

  expect(lireControle({ controle: { statut: 'VALIDE', raison: null } })?.statut).toBe('VALIDE');
  expect(lireControle({ controle: { statut: 'A_VERIFIER', raison: 'Loin' } })?.raison).toBe('Loin');
  expect(lireControle({})).toBeNull();
});

test('itinéraire : Apple Plans sur iOS, Google Maps ailleurs ; texte si domicile approximatif', () => {
  const point = { latitude: 14.6085, longitude: -61.068 };
  expect(lienItineraire('ios', { point, texte: '' })).toBe('https://maps.apple.com/?daddr=14.6085%2C-61.068&dirflg=d');
  expect(lienItineraire('android', { point, texte: '' })).toBe('https://www.google.com/maps/dir/?api=1&destination=14.6085%2C-61.068&travelmode=driving');
  expect(lienItineraire('web', { point: null, texte: 'Bourg, Rivière-Pilote, Martinique' })).toContain('destination=Bourg%2C%20Rivi%C3%A8re-Pilote%2C%20Martinique');
});

test('heures : heure de Martinique partout, format « 9 h 30 », heure locale ajoutée hors fuseau (D16, m7)', () => {
  // 13 h 30 UTC = 9 h 30 à la Martinique (UTC−4, pas d'heure d'été).
  expect(heureTexte('2026-10-08T13:30:00Z')).toBe('9 h 30');
  expect(heureTexte('2026-10-08T14:00:00Z')).toBe('10 h');
  // 2 h 30 UTC le 9 = 22 h 30 le 8 à la Martinique : même jour que 13 h UTC le 8.
  expect(memeJour('2026-10-09T02:30:00Z', '2026-10-08T13:00:00Z')).toBe(true);
  expect(libelleJour('2026-10-09T02:30:00Z', new Date('2026-10-08T13:00:00Z'))).toBe('Aujourd’hui');
  const plage = plageAvecFuseau('2026-10-08T13:30:00Z', '2026-10-08T15:30:00Z');
  expect(plage.startsWith('9 h 30 – 11 h 30, heure de Martinique')).toBe(true);
  expect(plage.includes('chez vous')).toBe(horsFuseauMartinique());
});
