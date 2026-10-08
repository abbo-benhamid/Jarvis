import { expect, test } from '@playwright/test';
import {
  demandeEnvoyee,
  etatVerificationSchema,
  peutDemander,
  reponseOrientationSchema,
  reponsesOrientationSchema,
  type EtatVerification,
  type ReponsesOrientation,
} from '../contratAccompagnant';
import { BROUILLON_VIDE, orienterLocalement, questionRepondue, reponsesCompletes } from '../orientation';
import { actionValidation, etapesValidation } from '../validation';

/** D15 : orientation et demande de vérification dans l'app (modules purs). */

const BASE: ReponsesOrientation = { activity: 'PRESENCE', paid: true, existingStatus: 'AUCUN', situations: [], familyLink: 'AUCUN' };

test('orientation : mêmes statuts que la règle du site', () => {
  expect(orienterLocalement(BASE)).toMatchObject({ issue: 'RECOMMANDE', statut: 'SALARIE_FAMILLE_CESU', niveaux: [1, 2, 3] });
  expect(orienterLocalement({ ...BASE, activity: 'LIEN', paid: false })).toMatchObject({ issue: 'RECOMMANDE', statut: 'BENEVOLE_ASSO' });
  expect(orienterLocalement({ ...BASE, paid: false })).toMatchObject({ issue: 'REFUSE', statut: null, pieces: [] });
  expect(orienterLocalement({ ...BASE, situations: ['AGENT_PUBLIC'] }).issue).toBe('LISTE_ATTENTE');
  expect(orienterLocalement({ ...BASE, familyLink: 'CONJOINT' }).issue).toBe('ORIENTATION_EXTERNE');
  expect(orienterLocalement({ ...BASE, familyLink: 'ENFANT_OU_PARENT' }).statut).toBe('PROCHE_AIDANT_APA');
  expect(orienterLocalement({ ...BASE, existingStatus: 'SALARIE_SAAD' }).statut).toBe('SAAD');
  expect(orienterLocalement({ ...BASE, activity: 'COUPS_DE_MAIN', existingStatus: 'AUTO_ENTREPRENEUR_SAP' }).statut).toBe('AUTO_ENTREPRENEUR_SAP');
  const etudiant = orienterLocalement({ ...BASE, situations: ['ETUDIANT'] });
  expect(etudiant.avertissements[0]).toContain('Étudiant');
  expect(etudiant.pieces).toEqual(['IDENTITE', 'CASIER_B3', 'REFERENCES', 'FORMATION', 'PSC1']);
});

test('orientation : rien coché au départ ; la question 4 peut rester vide', () => {
  expect(questionRepondue(BROUILLON_VIDE, 0)).toBe(false);
  expect(questionRepondue(BROUILLON_VIDE, 3)).toBe(true);
  expect(reponsesCompletes(BROUILLON_VIDE)).toBeNull();
  const complet = reponsesCompletes({ ...BASE, situations: ['RSA', 'RSA'] });
  expect(complet?.situations).toEqual(['RSA']);
  expect(reponsesOrientationSchema.safeParse(complet).success).toBe(true);
  expect(reponsesOrientationSchema.safeParse({ ...complet, champFutur: 1 }).success).toBe(false);
});

test('réponse du serveur : noms français ou forme du site, enveloppée ou non', () => {
  const fr = { issue: 'RECOMMANDE', statut: 'SAAD', explication: 'Texte.', avertissements: [], pieces: ['IDENTITE'], niveaux: [1, 2, 3, 4] };
  const web = { outcome: 'RECOMMANDE', status: 'SAAD', explanation: 'Texte.', warnings: [], requiredVerifications: ['IDENTITE'], allowedLevels: [1, 2, 3, 4], targetLevel: 3 };
  for (const corps of [fr, web, { orientation: fr }, { resultat: web }]) {
    const r = reponseOrientationSchema.safeParse(corps);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ issue: 'RECOMMANDE', statut: 'SAAD', pieces: ['IDENTITE'] });
  }
  const etat = etatVerificationSchema.parse({ validation: 'BROUILLON', orientation: web, manque: [{ label: 'Choisir au moins une commune' }] });
  expect(etat.manque).toEqual(['Choisir au moins une commune']);
  expect(etatVerificationSchema.parse({ validation: 'BROUILLON' })).toEqual({ validation: 'BROUILLON', orientation: null, manque: [], raison: null });
});

const ORIENTE = orienterLocalement(BASE);
const etat = (p: Partial<EtatVerification>): EtatVerification => ({ validation: 'BROUILLON', orientation: null, manque: [], raison: null, ...p });
const textes = (e: ReturnType<typeof etapesValidation>) => e.map((x) => `${x.titre} ${x.detail ?? ''}`).join(' | ');

test('écran de validation : « l’équipe vous appelle » seulement après la demande', () => {
  for (const v of [etat({}), etat({ orientation: ORIENTE }), etat({ validation: 'REFUSE', orientation: ORIENTE })]) {
    const t = textes(etapesValidation({ emailOk: true, verification: v, routesAbsentes: false }));
    expect(t).not.toMatch(/vous appelle|nous vous appelons/i);
  }
  const apres = etapesValidation({ emailOk: true, verification: etat({ validation: 'EN_ATTENTE', orientation: ORIENTE }), routesAbsentes: false });
  expect(textes(apres)).toContain('L’équipe vous appelle');
  expect(apres.map((e) => e.etat)).toEqual(['fait', 'fait', 'fait', 'fait', 'en_cours', 'a_venir']);
});

test('écran de validation : prochaine action', () => {
  const a = (v: EtatVerification | null, routesAbsentes = false) => actionValidation({ emailOk: true, verification: v, routesAbsentes });
  expect(a(null)).toBeNull();
  expect(a(null, true)).toBe('site');
  expect(a(etat({}))).toBe('orientation');
  expect(a(etat({ orientation: orienterLocalement({ ...BASE, paid: false }) }))).toBe('orientation');
  expect(a(etat({ orientation: ORIENTE }))).toBe('demander');
  expect(a(etat({ orientation: ORIENTE, manque: ['Fixer votre tarif horaire'] }))).toBe('completer_site');
  expect(a(etat({ validation: 'REFUSE', orientation: ORIENTE }))).toBe('demander');
  expect(a(etat({ validation: 'EN_ATTENTE', orientation: ORIENTE }))).toBe('attendre');
  expect(a(etat({ validation: 'SUSPENDU', orientation: ORIENTE }))).toBe('contacter');
  expect(peutDemander(etat({ orientation: ORIENTE }))).toBe(true);
  expect(demandeEnvoyee({ validation: 'BROUILLON' })).toBe(false);
});
