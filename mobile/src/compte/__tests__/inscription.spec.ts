import { expect, test } from '@playwright/test';
import { demandeInscriptionSchema, lireControle, reponseMoiL1Schema, demandeEvenementsL1Schema } from '../../contrats-l1';
import { lienItineraire } from '../../lib/geo';
import { emailAVerifier, etatCompte } from '../../session/compte';
import { CHAMPS_VIDES, dateVersIso, formaterSaisieDate, validerInscription } from '../formulaire';

/** L1-C : formulaire d'inscription, contrats provisoires, état du compte, lien d'itinéraire (modules purs). */

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

test('GET /me : serveur d’avant L1 accepté ; état du compte et rappel e-mail', () => {
  const base = { id: 'u1', role: 'ACCOMPAGNANT', prenom: 'J', nom: 'M', email: 'j@exemple.fr', demo: false, bacASable: false };
  expect(reponseMoiL1Schema.safeParse(base).success).toBe(true);
  expect(reponseMoiL1Schema.safeParse({ ...base, emailVerifie: false, profilValide: false, champFutur: 1 }).success).toBe(true);
  expect(etatCompte({})).toBe('actif');
  expect(etatCompte({ profilValide: false })).toBe('validation');
  expect(etatCompte({ profilValide: false, preinscription: true })).toBe('preinscription');
  expect(emailAVerifier({})).toBe(false);
  expect(emailAVerifier({ emailVerifie: false })).toBe(true);
});

test('CHECK_IN L1 : qr signé + position (consentement, simulee) ; contrôle lu où qu’il soit', () => {
  const ev = {
    type: 'CHECK_IN',
    visiteId: 'vis_1',
    clientEventId: '6f1c7a52-3b0e-4b8a-9d1e-0c2f4a6b8c10',
    survenuA: '2026-10-07T14:00:00.000Z',
    qr: 'koudmen:domicile:s1:eyJhIjoiYSJ9.c2ln',
    position: { latitude: 14.6, longitude: -61.07, precisionMetres: 12, consentement: true, simulee: false },
  };
  expect(demandeEvenementsL1Schema.safeParse({ evenements: [ev] }).success).toBe(true);
  expect(demandeEvenementsL1Schema.safeParse({ evenements: [{ ...ev, qr: 'koudmen:domicile:LKW7Q3' }] }).success).toBe(false);
  const { qr: _qr, position: _p, ...vide } = ev;
  expect(demandeEvenementsL1Schema.safeParse({ evenements: [vide] }).success).toBe(false);

  expect(lireControle({ controle: { statut: 'VALIDE', raison: null } })?.statut).toBe('VALIDE');
  expect(lireControle({ preuves: { qr: { statut: 'A_VERIFIER', raison: 'Loin' } } })?.raison).toBe('Loin');
  expect(lireControle({})).toBeNull();
});

test('itinéraire : Apple Plans sur iOS, Google Maps ailleurs ; texte si domicile approximatif', () => {
  const point = { latitude: 14.6085, longitude: -61.068 };
  expect(lienItineraire('ios', { point, texte: '' })).toBe('https://maps.apple.com/?daddr=14.6085%2C-61.068&dirflg=d');
  expect(lienItineraire('android', { point, texte: '' })).toBe('https://www.google.com/maps/dir/?api=1&destination=14.6085%2C-61.068&travelmode=driving');
  expect(lienItineraire('web', { point: null, texte: 'Bourg, Rivière-Pilote, Martinique' })).toContain('destination=Bourg%2C%20Rivi%C3%A8re-Pilote%2C%20Martinique');
});
