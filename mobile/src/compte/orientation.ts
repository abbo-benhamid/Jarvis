/**
 * D15 : « Mon statut en 5 questions » dans l'app. Module PUR (testable sans appareil).
 *
 * Questions, réponses et libellés : MÊMES textes que le site (`components/accompagnant/orientation-wizard.tsx`,
 * `orientation-result.tsx`, `lib/labels.ts`). Le SERVEUR calcule le résultat. `orienterLocalement` sert seulement
 * au mode simulé et aux tests : copie de `plateforme/src/server/rules/orientation.ts` (garder les deux alignés).
 */
import type {
  IssueOrientation,
  Piece,
  ReponsesOrientation,
  ResultatOrientation,
  Situation,
  StatutAccompagnant,
} from './contratAccompagnant';

export type OptionOrientation<V extends string> = { value: V; label: string; hint?: string };

export const Q1: OptionOrientation<ReponsesOrientation['activity']>[] = [
  { value: 'LIEN', label: 'Du lien', hint: 'Visites, appels, promenades, lecture.' },
  { value: 'COUPS_DE_MAIN', label: 'Des coups de main', hint: 'Courses, repas, papiers, numérique.' },
  { value: 'PRESENCE', label: 'De la présence', hint: 'Compagnie régulière, aide au repas, rendez-vous, sorties.' },
  { value: 'AIDE_RENFORCEE', label: 'De l’aide renforcée', hint: 'Toilette, transferts, nuits. Un diplôme est obligatoire.' },
];
export const Q2: OptionOrientation<'oui' | 'non'>[] = [
  { value: 'oui', label: 'Oui, je veux être payé(e)' },
  { value: 'non', label: 'Non, je veux aider comme bénévole' },
];
export const Q3: OptionOrientation<ReponsesOrientation['existingStatus']>[] = [
  { value: 'AUCUN', label: 'Non, je n’ai pas de statut' },
  { value: 'AUTO_ENTREPRENEUR_SAP', label: 'Oui, j’ai une micro-entreprise de services à la personne' },
  { value: 'SALARIE_SAAD', label: 'Oui, je travaille pour un SAAD', hint: 'Un service d’aide à domicile autorisé par le Département.' },
];
export const Q4: OptionOrientation<Situation>[] = [
  { value: 'ETUDIANT', label: 'Étudiant(e)' },
  { value: 'RETRAITE', label: 'Retraité(e)' },
  { value: 'DEMANDEUR_EMPLOI', label: 'Demandeur d’emploi' },
  { value: 'RSA', label: 'Je reçois le RSA' },
  { value: 'TEMPS_PARTIEL', label: 'Salarié(e) à temps partiel' },
  { value: 'AGENT_PUBLIC', label: 'Agent public', hint: 'Fonctionnaire ou contractuel de la fonction publique.' },
  { value: 'TITRE_SEJOUR_ETUDIANT', label: 'Titre de séjour étudiant' },
];
export const Q5: OptionOrientation<ReponsesOrientation['familyLink']>[] = [
  { value: 'AUCUN', label: 'Non, pas de lien familial' },
  { value: 'ENFANT_OU_PARENT', label: 'Oui, je suis son enfant ou son parent' },
  { value: 'CONJOINT', label: 'Oui, je suis son conjoint', hint: 'Mari, femme, partenaire de PACS ou concubin.' },
];

export const QUESTIONS = [
  'Que voulez-vous faire ?',
  'Voulez-vous être payé(e) ?',
  'Avez-vous déjà un statut professionnel ?',
  'Quelle est votre situation aujourd’hui ?',
  'Avez-vous un lien familial avec la personne que vous allez aider ?',
] as const;

export const TITRES_ISSUE: Record<IssueOrientation, string> = {
  RECOMMANDE: 'Statut recommandé',
  REFUSE: 'Pas de statut possible avec ces réponses',
  LISTE_ATTENTE: 'Vous êtes sur la liste d’attente',
  ORIENTATION_EXTERNE: 'Une autre aide existe pour vous',
};

export const LIBELLES_STATUT: Record<StatutAccompagnant, string> = {
  SALARIE_FAMILLE_CESU: 'Payé par la famille, avec le CESU',
  AUTO_ENTREPRENEUR_SAP: 'Micro-entreprise de services à la personne',
  PROCHE_AIDANT_APA: 'Proche de l’aîné, payé avec l’aide autonomie',
  BENEVOLE_ASSO: 'Bénévole via une association',
  SAAD: 'Structure partenaire (SAAD)',
};

export const LIBELLES_PIECE: Record<Piece, string> = {
  IDENTITE: 'Pièce d’identité',
  CASIER_B3: 'Extrait de casier judiciaire',
  REFERENCES: 'Deux références',
  FORMATION: 'Formation Koudmen',
  STATUT_PRO: 'Preuve de votre statut (numéro d’entreprise ou service d’aide)',
  PSC1: 'Formation aux premiers secours',
  DIPLOME: 'Diplôme d’aide à la personne',
};

export const LIBELLES_NIVEAU: Record<number, string> = {
  1: 'Niveau 1 · Lien',
  2: 'Niveau 2 · Coups de main',
  3: 'Niveau 3 · Présence',
  4: 'Niveau 4 · Aide renforcée',
};

/** Brouillon pendant les questions : rien n'est choisi au départ (pas de réponse cochée par défaut). */
export type BrouillonOrientation = Partial<Omit<ReponsesOrientation, 'situations'>> & { situations: Situation[] };
export const BROUILLON_VIDE: BrouillonOrientation = { situations: [] };

/** La question `etape` (0 à 4) a-t-elle une réponse ? La question 4 (situations) peut rester vide. */
export function questionRepondue(b: BrouillonOrientation, etape: number): boolean {
  switch (etape) {
    case 0:
      return b.activity !== undefined;
    case 1:
      return b.paid !== undefined;
    case 2:
      return b.existingStatus !== undefined;
    case 3:
      return true;
    case 4:
      return b.familyLink !== undefined;
    default:
      return false;
  }
}

/** Brouillon complet → réponses à envoyer. `null` s'il manque une réponse. */
export function reponsesCompletes(b: BrouillonOrientation): ReponsesOrientation | null {
  if (b.activity === undefined || b.paid === undefined || b.existingStatus === undefined || b.familyLink === undefined) return null;
  return { activity: b.activity, paid: b.paid, existingStatus: b.existingStatus, situations: [...new Set(b.situations)], familyLink: b.familyLink };
}

// ─────────────── Copie de la règle du serveur (mode simulé seulement) ───────────────

const NIVEAU_ACTIVITE: Record<ReponsesOrientation['activity'], number> = { LIEN: 1, COUPS_DE_MAIN: 2, PRESENCE: 3, AIDE_RENFORCEE: 4 };
const NIVEAUX_STATUT: Record<StatutAccompagnant, number[]> = {
  SALARIE_FAMILLE_CESU: [1, 2, 3],
  AUTO_ENTREPRENEUR_SAP: [2],
  PROCHE_AIDANT_APA: [1, 2, 3],
  BENEVOLE_ASSO: [1],
  SAAD: [1, 2, 3, 4],
};
const CUMUL: Partial<Record<Situation, string>> = {
  ETUDIANT: 'Étudiant : gardez du temps pour vos études. Vos heures comptent dans vos revenus déclarés.',
  RETRAITE: 'Retraité : vous pouvez travailler et toucher votre retraite. Demandez les règles à votre caisse de retraite.',
  DEMANDEUR_EMPLOI: 'Demandeur d’emploi : déclarez vos heures chaque mois à France Travail.',
  RSA: 'RSA : déclarez ces revenus à la CAF chaque trimestre.',
  TEMPS_PARTIEL: 'Salarié à temps partiel : vérifiez la clause d’exclusivité de votre contrat.',
};

function piecesPour(statut: StatutAccompagnant, niveaux: number[], vise: number): Piece[] {
  const p: Piece[] = ['IDENTITE', 'CASIER_B3'];
  if (statut !== 'BENEVOLE_ASSO') p.push('REFERENCES');
  p.push('FORMATION');
  if (statut === 'AUTO_ENTREPRENEUR_SAP' || statut === 'SAAD') p.push('STATUT_PRO');
  if (niveaux.includes(3) || vise >= 3) p.push('PSC1');
  if (vise === 4 && statut !== 'SAAD') p.push('DIPLOME');
  return p;
}

export function orienterLocalement(r: ReponsesOrientation): ResultatOrientation {
  const vise = NIVEAU_ACTIVITE[r.activity];
  const avertissements: string[] = [];
  const resultat = (issue: IssueOrientation, statut: StatutAccompagnant | null, explication: string): ResultatOrientation => {
    const niveaux = statut ? NIVEAUX_STATUT[statut] : [];
    return { issue, statut, explication, avertissements, niveaux, pieces: statut ? piecesPour(statut, niveaux, vise) : [] };
  };

  if (!r.paid) {
    if (vise === 1) {
      return resultat(
        'RECOMMANDE',
        'BENEVOLE_ASSO',
        'Vous aidez sans être payé(e). Vous rejoignez Koudmen via une association partenaire. Vous faites du lien : visites, appels, promenades.',
      );
    }
    return resultat('REFUSE', null, 'Une aide régulière se paie et se déclare. Choisissez d’être payé(e), ou faites du lien (niveau 1) comme bénévole.');
  }
  if (r.situations.includes('AGENT_PUBLIC') || r.situations.includes('TITRE_SEJOUR_ETUDIANT')) {
    return resultat(
      'LISTE_ATTENTE',
      null,
      'Votre situation demande une démarche spéciale (autorisation de l’employeur public ou déclaration en préfecture). Nous vous inscrivons sur la liste d’attente.',
    );
  }
  for (const s of r.situations) {
    const w = CUMUL[s];
    if (w) avertissements.push(w);
  }

  let statut: StatutAccompagnant;
  let explication: string;
  if (r.existingStatus === 'SALARIE_SAAD') {
    statut = 'SAAD';
    explication = 'Vous travaillez pour un SAAD, un service d’aide à domicile. Ce service porte vos missions.';
  } else if (vise === 4) {
    statut = 'SALARIE_FAMILLE_CESU';
    explication =
      'L’aide renforcée demande un diplôme d’aide à la personne. La famille vous paie avec le CESU. Le niveau 4 s’ouvre quand l’équipe valide votre diplôme.';
  } else if (r.existingStatus === 'AUTO_ENTREPRENEUR_SAP' && vise === 2) {
    statut = 'AUTO_ENTREPRENEUR_SAP';
    explication = 'Vous avez une micro-entreprise de services à la personne. Vous faites des coups de main (niveau 2) : courses, repas, papiers, numérique.';
  } else {
    statut = 'SALARIE_FAMILLE_CESU';
    explication = 'La famille vous emploie et vous paie avec le CESU. C’est le statut le plus simple et le plus sûr.';
    if (r.existingStatus === 'AUTO_ENTREPRENEUR_SAP') {
      avertissements.push('La compagnie et la présence ne se font pas en auto-entrepreneur. Pour ces missions, la famille vous emploie avec le CESU.');
    }
  }

  if (r.familyLink === 'CONJOINT') {
    return resultat(
      'ORIENTATION_EXTERNE',
      null,
      'Un conjoint ne peut pas être payé avec l’aide autonomie du Département. D’autres aides existent pour les proches aidants : demandez-les au Département ou à la CAF.',
    );
  }
  if (r.familyLink === 'ENFANT_OU_PARENT' && statut === 'SALARIE_FAMILLE_CESU') {
    statut = 'PROCHE_AIDANT_APA';
    explication =
      'Vous êtes un proche de la personne aidée. Vous pouvez être payé avec l’aide autonomie du Département. Vous êtes visible seulement dans son cercle Lakou.';
  }
  return resultat('RECOMMANDE', statut, explication);
}
