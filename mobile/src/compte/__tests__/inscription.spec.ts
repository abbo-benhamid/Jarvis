import { expect, test } from '@playwright/test';
import { demandeEvenementsSchema, demandeInscriptionSchema, reponseMoiSchema } from '../../contracts';
import { lireControle } from '../../api/l1';
import { heureTexte, horsFuseau, libelleJour, memeJour, plageAvecFuseau } from '../../lib/format';
import { lienItineraire } from '../../lib/geo';
import { demandeInscriptionTerritoireSchema } from '../../territoires';
import { emailAVerifier, etatCompte } from '../../session/compte';
import { CHAMPS_VIDES, dateVersIso, formaterSaisieDate, validerInscription } from '../formulaire';

/** L1 : formulaire d'inscription, contrats serveur synchronisés (D13), état du compte, lien d'itinéraire (modules purs). */

const AUJOURDHUI = new Date('2026-10-07T12:00:00Z');
const OK = {
  ...CHAMPS_VIDES,
  prenom: ' Josiane ',
  nom: 'Mathurin',
  email: 'Josiane@Exemple.fr',
  telephone: '0690 12 34 56',
  dateNaissance: '05/03/1990',
  motDePasse: 'une phrase longue',
  commune: 'POINTE_A_PITRE',
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
    telephone: '0690 12 34 56',
    dateNaissance: '1990-03-05',
    motDePasse: 'une phrase longue',
    territoire: 'GUADELOUPE',
    commune: 'POINTE_A_PITRE',
    accepteCgu: true,
  });
  expect(demandeInscriptionTerritoireSchema.safeParse({ role: 'ACCOMPAGNANT', ...r.demande }).success).toBe(true);
  // Décision de l'orchestrateur : la politique de confidentialité est un lien, pas une case.
  expect(demandeInscriptionTerritoireSchema.safeParse({ role: 'ACCOMPAGNANT', ...r.demande, accepteConfidentialite: true }).success).toBe(false);
  // Sans le territoire, le contrat L1 actuel accepte encore la demande (écart provisoire, T1-G2-notes).
  const { territoire: _t, ...sansTerritoire } = r.demande;
  expect(demandeInscriptionSchema.safeParse({ role: 'ACCOMPAGNANT', ...sansTerritoire }).success).toBe(true);
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
  // T1 : une commune de Martinique n'est pas une commune de Guadeloupe.
  const autreIle = validerInscription({ ...OK, commune: 'FORT_DE_FRANCE' }, AUJOURDHUI);
  expect(!autreIle.ok && autreIle.erreurs.commune).toBeTruthy();
  // T1 : Martinique, Guyane, Hexagone « Bientôt » : l'inscription explique et propose la liste d'attente.
  const bientot = validerInscription({ ...OK, territoire: 'MARTINIQUE', commune: 'FORT_DE_FRANCE' }, AUJOURDHUI);
  expect(!bientot.ok && bientot.erreurs.territoire).toContain('Koudmen ouvre d’abord en Guadeloupe');
  expect(!bientot.ok && bientot.erreurs.territoire).toContain('liste d’attente');
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
  expect(lienItineraire('web', { point: null, texte: 'Bourg, Sainte-Anne, Guadeloupe' })).toContain('destination=Bourg%2C%20Sainte-Anne%2C%20Guadeloupe');
});

/** Espaces insécables → espaces simples, pour lire les attentes. */
const simple = (s: string) => s.replace(/[  ]/g, ' ');

test('heures : heure du territoire (Guadeloupe par défaut), format « 9 h 30 », heure du téléphone si différente (D16, T4)', () => {
  // 13 h 30 UTC = 9 h 30 en Guadeloupe (America/Guadeloupe, UTC−4, pas d'heure d'été).
  expect(simple(heureTexte('2026-10-08T13:30:00Z'))).toBe('9 h 30');
  expect(simple(heureTexte('2026-10-08T14:00:00Z', 'America/Guadeloupe'))).toBe('10 h');
  expect(simple(heureTexte('2026-10-08T14:00:00Z', 'America/Martinique'))).toBe('10 h');
  // 2 h 30 UTC le 9 = 22 h 30 le 8 en Guadeloupe : même jour que 13 h UTC le 8.
  expect(memeJour('2026-10-09T02:30:00Z', '2026-10-08T13:00:00Z')).toBe(true);
  expect(libelleJour('2026-10-09T02:30:00Z', new Date('2026-10-08T13:00:00Z'))).toBe('Aujourd’hui');
  // Téléphone en Guadeloupe : pas d'heure en plus.
  const ici = plageAvecFuseau('2026-10-08T13:30:00Z', '2026-10-08T15:30:00Z', 'America/Guadeloupe', 'America/Guadeloupe');
  expect(simple(ici)).toBe('9 h 30 – 11 h 30, heure de Guadeloupe');
  // Téléphone dans l'Hexagone (heure d'été, UTC+2) : heure en plus.
  const paris = plageAvecFuseau('2026-07-08T13:30:00Z', '2026-07-08T15:30:00Z', 'America/Guadeloupe', 'Europe/Paris');
  expect(simple(paris)).toBe('9 h 30 – 11 h 30, heure de Guadeloupe (15 h 30 – 17 h 30 chez vous)');
  // Fuseau du système : « chez vous » seulement si le téléphone n'est pas à l'heure de Guadeloupe.
  const systeme = plageAvecFuseau('2026-10-08T13:30:00Z', '2026-10-08T15:30:00Z');
  expect(systeme.includes('chez vous')).toBe(horsFuseau('America/Guadeloupe', new Date('2026-10-08T13:30:00Z')));
});

test('heures : Guyane (UTC−3) et Hexagone (heure d’été, heure d’hiver, changement d’heure)', () => {
  // Guyane : 13 h 30 UTC = 10 h 30, toute l'année.
  expect(simple(plageAvecFuseau('2026-10-08T13:30:00Z', '2026-10-08T15:00:00Z', 'America/Cayenne', 'America/Cayenne'))).toBe(
    '10 h 30 – 12 h, heure de Guyane',
  );
  expect(simple(plageAvecFuseau('2026-10-08T13:30:00Z', '2026-10-08T15:00:00Z', 'America/Cayenne', 'America/Guadeloupe'))).toBe(
    '10 h 30 – 12 h, heure de Guyane (9 h 30 – 11 h chez vous)',
  );
  // Hexagone, été (UTC+2) et hiver (UTC+1).
  expect(simple(heureTexte('2026-07-08T14:00:00Z', 'Europe/Paris'))).toBe('16 h');
  expect(simple(heureTexte('2026-12-08T14:00:00Z', 'Europe/Paris'))).toBe('15 h');
  expect(simple(plageAvecFuseau('2026-12-08T14:00:00Z', '2026-12-08T16:00:00Z', 'Europe/Paris', 'America/Guadeloupe'))).toBe(
    '15 h – 17 h, heure de Paris (10 h – 12 h chez vous)',
  );
  // Changements d'heure 2026 : dimanche 29 mars et dimanche 25 octobre, à 1 h UTC.
  expect(simple(heureTexte('2026-03-29T00:59:00Z', 'Europe/Paris'))).toBe('1 h 59');
  expect(simple(heureTexte('2026-03-29T01:00:00Z', 'Europe/Paris'))).toBe('3 h');
  expect(simple(heureTexte('2026-10-25T00:59:00Z', 'Europe/Paris'))).toBe('2 h 59');
  expect(simple(heureTexte('2026-10-25T01:00:00Z', 'Europe/Paris'))).toBe('2 h');
  // Le jour dépend du territoire : 23 h UTC le 8 = 1 h le 9 à Paris (été), 19 h le 8 en Guadeloupe.
  expect(memeJour('2026-07-08T23:00:00Z', '2026-07-08T12:00:00Z', 'Europe/Paris')).toBe(false);
  expect(memeJour('2026-07-08T23:00:00Z', '2026-07-08T12:00:00Z', 'America/Guadeloupe')).toBe(true);
  // Même résultat que `Intl` (base des fuseaux IANA de Node).
  for (const iso of ['2026-01-15T12:00:00Z', '2026-03-29T01:30:00Z', '2026-07-01T00:00:00Z', '2026-10-25T00:30:00Z', '2027-10-31T01:00:00Z']) {
    for (const fuseau of ['America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Europe/Paris']) {
      const attendu = new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
      const [h, m] = attendu.split(':').map(Number);
      expect(simple(heureTexte(iso, fuseau))).toBe(m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`);
    }
  }
});
