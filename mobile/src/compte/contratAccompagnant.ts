/**
 * D15 (L1d) : orientation et demande de vérification DANS l'app.
 *
 * CONTRAT CÔTÉ APP, EN ATTENTE DU CONTRAT SERVEUR (agent F1, routes `/api/v1/accompagnant/…`).
 * Quand `plateforme/src/contracts/v1/` publie ces schémas, l'app doit les importer depuis `@/contracts`
 * et supprimer ce fichier (même règle que D13). Écarts possibles notés dans `docs/tech/L1d-F3-notes.md`.
 *
 * | Route (Bearer accompagnant)              | Corps                       | Réponse              |
 * |------------------------------------------|-----------------------------|----------------------|
 * | GET  /api/v1/accompagnant/verification   | —                           | `EtatVerification`   |
 * | POST /api/v1/accompagnant/orientation    | `ReponsesOrientation`       | `ResultatOrientation`|
 * | POST /api/v1/accompagnant/verification   | `{}`                        | `EtatVerification`   |
 *
 * Les clés des réponses à l'orientation sont celles du serveur web (`server/rules/orientation.ts`) :
 * le serveur peut valider le corps avec `orientationSchema` sans traduction.
 * Les schémas de RÉPONSE sont tolérants : ils acceptent les noms français (contrats v1) ou anglais (règles du web).
 */
import { z } from 'zod';

// ─────────────── Réponses aux 5 questions (mêmes valeurs que le site) ───────────────

export const activiteSchema = z.enum(['LIEN', 'COUPS_DE_MAIN', 'PRESENCE', 'AIDE_RENFORCEE']);
export const statutExistantSchema = z.enum(['AUCUN', 'AUTO_ENTREPRENEUR_SAP', 'SALARIE_SAAD']);
export const situationSchema = z.enum(['ETUDIANT', 'RETRAITE', 'DEMANDEUR_EMPLOI', 'RSA', 'TEMPS_PARTIEL', 'AGENT_PUBLIC', 'TITRE_SEJOUR_ETUDIANT']);
export const lienFamilialSchema = z.enum(['AUCUN', 'ENFANT_OU_PARENT', 'CONJOINT']);

export const reponsesOrientationSchema = z
  .object({
    activity: activiteSchema,
    paid: z.boolean(),
    existingStatus: statutExistantSchema,
    situations: z.array(situationSchema).max(7),
    familyLink: lienFamilialSchema,
  })
  .strict();
export type ReponsesOrientation = z.infer<typeof reponsesOrientationSchema>;
export type Situation = z.infer<typeof situationSchema>;

// ─────────────── Résultat ───────────────

export const issueOrientationSchema = z.enum(['RECOMMANDE', 'REFUSE', 'LISTE_ATTENTE', 'ORIENTATION_EXTERNE']);
export type IssueOrientation = z.infer<typeof issueOrientationSchema>;

export const statutAccompagnantSchema = z.enum(['SALARIE_FAMILLE_CESU', 'AUTO_ENTREPRENEUR_SAP', 'PROCHE_AIDANT_APA', 'BENEVOLE_ASSO', 'SAAD']);
export type StatutAccompagnant = z.infer<typeof statutAccompagnantSchema>;

export const pieceSchema = z.enum(['IDENTITE', 'CASIER_B3', 'REFERENCES', 'FORMATION', 'STATUT_PRO', 'PSC1', 'DIPLOME']);
export type Piece = z.infer<typeof pieceSchema>;

/** Forme lue par l'app (après normalisation). */
export type ResultatOrientation = {
  issue: IssueOrientation;
  statut: StatutAccompagnant | null;
  explication: string;
  avertissements: string[];
  pieces: Piece[];
  niveaux: number[];
};

const texte = z.string().max(600);
const resultatFrancais = z
  .object({
    issue: issueOrientationSchema,
    statut: statutAccompagnantSchema.nullable(),
    explication: texte,
    avertissements: z.array(texte).max(10).optional(),
    pieces: z.array(pieceSchema).max(10).optional(),
    niveaux: z.array(z.number().int().min(1).max(4)).max(4).optional(),
  })
  .transform((r): ResultatOrientation => ({
    issue: r.issue,
    statut: r.statut,
    explication: r.explication,
    avertissements: r.avertissements ?? [],
    pieces: r.pieces ?? [],
    niveaux: r.niveaux ?? [],
  }));
/** Forme `OrientationResult` du site (`server/rules/orientation.ts`), si F1 la renvoie telle quelle. */
const resultatWeb = z
  .object({
    outcome: issueOrientationSchema,
    status: statutAccompagnantSchema.nullable(),
    explanation: texte,
    warnings: z.array(texte).max(10).optional(),
    requiredVerifications: z.array(pieceSchema).max(10).optional(),
    allowedLevels: z.array(z.number().int().min(1).max(4)).max(4).optional(),
  })
  .transform((r): ResultatOrientation => ({
    issue: r.outcome,
    statut: r.status,
    explication: r.explanation,
    avertissements: r.warnings ?? [],
    pieces: r.requiredVerifications ?? [],
    niveaux: r.allowedLevels ?? [],
  }));

export const resultatOrientationSchema = z.union([resultatFrancais, resultatWeb]);
/** Réponse de POST /orientation : le résultat seul, ou enveloppé dans `{ orientation }` / `{ resultat }`. */
export const reponseOrientationSchema = z.union([
  resultatOrientationSchema,
  z.object({ orientation: resultatOrientationSchema }).transform((r) => r.orientation),
  z.object({ resultat: resultatOrientationSchema }).transform((r) => r.resultat),
]);

// ─────────────── État de la vérification ───────────────

/** Statuts de validation du profil (mêmes valeurs que `CaregiverValidation` du serveur). */
export const validationSchema = z.enum(['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'REFUSE', 'SUSPENDU']);
export type Validation = z.infer<typeof validationSchema>;

export type EtatVerification = {
  validation: Validation;
  /** Résultat de l'orientation enregistrée, `null` si elle n'est pas faite. */
  orientation: ResultatOrientation | null;
  /** Ce qui manque encore pour demander la vérification (libellés affichables). */
  manque: string[];
  /** Raison d'un refus, en français simple. */
  raison: string | null;
};

export const etatVerificationSchema = z
  .object({
    validation: validationSchema,
    orientation: resultatOrientationSchema.nullable().optional(),
    manque: z.array(z.union([z.string().max(200), z.object({ label: z.string().max(200) }).transform((m) => m.label)])).max(20).optional(),
    raison: z.string().max(300).nullable().optional(),
  })
  .transform(
    (r): EtatVerification => ({
      validation: r.validation,
      orientation: r.orientation ?? null,
      manque: r.manque ?? [],
      raison: r.raison ?? null,
    }),
  );

/** La demande est partie (l'équipe a le dossier) : seulement là, l'app peut dire « l'équipe vous appelle ». */
export function demandeEnvoyee(e: Pick<EtatVerification, 'validation'>): boolean {
  return e.validation === 'EN_ATTENTE' || e.validation === 'VALIDE';
}

/** L'accompagnante peut envoyer la demande : orientation recommandée, rien ne manque, pas déjà envoyée. */
export function peutDemander(e: EtatVerification): boolean {
  return (
    (e.validation === 'BROUILLON' || e.validation === 'REFUSE') &&
    e.orientation?.issue === 'RECOMMANDE' &&
    e.manque.length === 0
  );
}
