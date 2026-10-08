import { expect, test } from '@playwright/test';
import { demandeOrientationSchema, etatVerificationSchema, resultatOrientationSchema, type EtatVerification } from '../../contracts';
import { BROUILLON_VIDE, orienterLocalement, questionRepondue, reponsesCompletes, type ReponsesOrientation } from '../orientation';
import { actionValidation, demandeEnvoyee, etapesValidation } from '../validation';

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
  expect(demandeOrientationSchema.safeParse(complet).success).toBe(true);
  expect(demandeOrientationSchema.safeParse({ ...complet, champFutur: 1 }).success).toBe(false);
});

test('réponse du serveur : contrat F1 strict, en français seulement', () => {
  const fr = { issue: 'RECOMMANDE', statut: 'SAAD', explication: 'Texte.', avertissements: [], pieces: ['IDENTITE'], niveaux: [1, 2, 3, 4] };
  expect(resultatOrientationSchema.safeParse(fr).success).toBe(true);
  // Plus de forme anglaise du site ni d'enveloppe : une réponse hors contrat donne REPONSE_INVALIDE.
  const web = { outcome: 'RECOMMANDE', status: 'SAAD', explanation: 'Texte.', warnings: [], requiredVerifications: ['IDENTITE'], allowedLevels: [1, 2, 3, 4] };
  for (const corps of [web, { orientation: fr }, { resultat: fr }]) expect(resultatOrientationSchema.safeParse(corps).success).toBe(false);
  // `etapes` et `peutDemander` sont obligatoires.
  expect(etatVerificationSchema.safeParse({ validation: 'BROUILLON', orientation: null, manque: [], raison: null }).success).toBe(false);
  expect(etatVerificationSchema.safeParse(etat({})).success).toBe(true);
});

const ORIENTE = orienterLocalement(BASE);
/** Même calcul que le serveur (`verification-app.ts`) quand rien ne manque sur le site. */
function etat(p: Partial<EtatVerification>): EtatVerification {
  const validation = p.validation ?? 'BROUILLON';
  const orientation = p.orientation ?? null;
  const rec = orientation?.issue === 'RECOMMANDE';
  const manque = p.manque ?? [];
  return {
    validation,
    orientation,
    etapes: [
      { code: 'ORIENTATION', libelle: 'Répondre aux 5 questions', faite: rec, surLeSite: false },
      { code: 'PROFIL', libelle: 'Communes, disponibilités et tarif', faite: rec && manque.length === 0, surLeSite: true },
      { code: 'PIECES', libelle: 'Déclarer vos pièces', faite: rec, surLeSite: true },
      { code: 'DEMANDE', libelle: 'Demander la vérification', faite: validation === 'EN_ATTENTE' || validation === 'VALIDE', surLeSite: false },
      { code: 'APPEL_EQUIPE', libelle: 'Appel de l’équipe Koudmen, puis validation', faite: validation === 'VALIDE', surLeSite: false },
    ],
    manque,
    raison: null,
    peutDemander: rec && manque.length === 0 && (validation === 'BROUILLON' || validation === 'REFUSE'),
    ...p,
  };
}
const textes = (e: ReturnType<typeof etapesValidation>) => e.map((x) => `${x.titre} ${x.detail ?? ''}`).join(' | ');

test('écran de validation : « l’équipe vous appelle » seulement après la demande', () => {
  for (const v of [etat({}), etat({ orientation: ORIENTE }), etat({ validation: 'REFUSE', orientation: ORIENTE })]) {
    const t = textes(etapesValidation({ emailOk: true, verification: v, routesAbsentes: false }));
    expect(t).not.toMatch(/vous appelle|nous vous appelons/i);
  }
  const apres = etapesValidation({ emailOk: true, verification: etat({ validation: 'EN_ATTENTE', orientation: ORIENTE }), routesAbsentes: false });
  expect(textes(apres)).toContain('L’équipe vous appelle');
  expect(apres.map((e) => e.etat)).toEqual(['fait', 'fait', 'fait', 'fait', 'fait', 'fait', 'en_cours']);
});

test('écran de validation : TOUTES les étapes du serveur, dans son ordre, avec ses libellés', () => {
  const v = etat({ orientation: ORIENTE, manque: ['Choisir au moins une commune (sur le site)'] });
  const e = etapesValidation({ emailOk: true, verification: v, routesAbsentes: false });
  expect(e.map((x) => x.titre)).toEqual([
    'Compte créé',
    'E-mail confirmé',
    'Répondre aux 5 questions',
    'Communes, disponibilités et tarif',
    'Déclarer vos pièces',
    'Demander la vérification',
    'Appel de l’équipe Koudmen, puis validation',
  ]);
  // Une seule étape « en cours » : la première non faite. L'étape du site le dit.
  expect(e.map((x) => x.etat)).toEqual(['fait', 'fait', 'fait', 'en_cours', 'fait', 'a_venir', 'a_venir']);
  expect(e[3]?.detail).toContain('Sur le site Koudmen');
  expect(e[2]?.detail).toBe('Payé par la famille, avec le CESU');
  // E-mail pas confirmé : c'est lui l'étape en cours.
  const sansEmail = etapesValidation({ emailOk: false, verification: etat({}), routesAbsentes: false });
  expect(sansEmail.filter((x) => x.etat === 'en_cours').map((x) => x.titre)).toEqual(['Confirmer votre e-mail']);
});

test('écran de validation : prochaine action (peutDemander du serveur)', () => {
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
  // Le serveur décide : orientation faite mais `peutDemander: false` → pas de bouton « Demander ».
  expect(a(etat({ orientation: ORIENTE, peutDemander: false }))).toBeNull();
  expect(demandeEnvoyee({ validation: 'BROUILLON' })).toBe(false);
});
