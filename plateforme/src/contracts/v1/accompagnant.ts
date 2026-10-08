/**
 * Contrat API v1 — orientation et demande de vérification de l'accompagnant DANS l'app (lot L1d, décision D15).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * | Route (Bearer accompagnant)              | Corps                     | Réponse                 |
 * |------------------------------------------|---------------------------|-------------------------|
 * | GET  /api/v1/accompagnant/verification   | —                         | 200 `EtatVerification`  |
 * | POST /api/v1/accompagnant/orientation    | `DemandeOrientation`      | 200 `ResultatOrientation` |
 * | POST /api/v1/accompagnant/verification   | `{}`                      | 200 `EtatVerification`  |
 *
 * Les clés des réponses à l'orientation sont celles du site (`server/rules/orientation.ts`), comme dans l'app
 * (`mobile/src/compte/contratAccompagnant.ts`) : `activity`, `paid`, `existingStatus`, `situations`, `familyLink`.
 * Les réponses (résultat, état) sont en français, sans donnée de santé ni pièce justificative.
 */
import { z } from "zod";

// ─────────────── Orientation (5 questions) ───────────────

export const activiteSchema = z.enum(["LIEN", "COUPS_DE_MAIN", "PRESENCE", "AIDE_RENFORCEE"]);
export const statutExistantSchema = z.enum(["AUCUN", "AUTO_ENTREPRENEUR_SAP", "SALARIE_SAAD"]);
export const situationSchema = z.enum(["ETUDIANT", "RETRAITE", "DEMANDEUR_EMPLOI", "RSA", "TEMPS_PARTIEL", "AGENT_PUBLIC", "TITRE_SEJOUR_ETUDIANT"]);
export const lienFamilialSchema = z.enum(["AUCUN", "ENFANT_OU_PARENT", "CONJOINT"]);

export const demandeOrientationSchema = z
  .object({
    /** Q1 — Que voulez-vous faire ? (niveau visé 1 à 4) */
    activity: activiteSchema,
    /** Q2 — Voulez-vous être payé(e) ? */
    paid: z.boolean(),
    /** Q3 — Avez-vous déjà un statut professionnel ? */
    existingStatus: statutExistantSchema,
    /** Q4 — Situation aujourd'hui (plusieurs réponses, sans doublon). */
    situations: z.array(situationSchema).max(7),
    /** Q5 — Lien familial avec la personne aidée ? */
    familyLink: lienFamilialSchema,
  })
  .strict();
export type DemandeOrientation = z.infer<typeof demandeOrientationSchema>;

export const issueOrientationSchema = z.enum(["RECOMMANDE", "REFUSE", "LISTE_ATTENTE", "ORIENTATION_EXTERNE"]);
export const statutAccompagnantSchema = z.enum(["SALARIE_FAMILLE_CESU", "AUTO_ENTREPRENEUR_SAP", "PROCHE_AIDANT_APA", "BENEVOLE_ASSO", "SAAD"]);
export const pieceSchema = z.enum(["IDENTITE", "CASIER_B3", "REFERENCES", "FORMATION", "STATUT_PRO", "PSC1", "DIPLOME"]);

const texte = z.string().max(600);

export const resultatOrientationSchema = z
  .object({
    issue: issueOrientationSchema,
    /** Statut recommandé (null si l'issue n'est pas RECOMMANDE). */
    statut: statutAccompagnantSchema.nullable(),
    explication: texte,
    /** Règles de cumul et alertes (n'empêchent pas l'inscription). */
    avertissements: z.array(texte).max(10),
    /** Pièces à montrer à l'équipe (aucune copie n'est envoyée par l'app). */
    pieces: z.array(pieceSchema).max(10),
    /** Niveaux d'accompagnement permis (1 à 4). */
    niveaux: z.array(z.number().int().min(1).max(4)).max(4),
  })
  .strict();
export type ResultatOrientation = z.infer<typeof resultatOrientationSchema>;

// ─────────────── État de la vérification ───────────────

/** Mêmes valeurs que `CaregiverValidation` du serveur. L2 : + A_COMPLETER (complément demandé), EXPIRE (élément arrivé à échéance). */
export const validationProfilSchema = z.enum(["BROUILLON", "EN_ATTENTE", "A_COMPLETER", "VALIDE", "REFUSE", "SUSPENDU", "EXPIRE"]);

/**
 * Étapes affichées dans l'app, dans l'ordre.
 * L2 : TELEPHONE, IDENTITE, ENTREPRISE, ADRESSE (faites dans l'app ou sur le site ; détail : GET /accompagnant/verifications).
 * Une étape L2 absente de la liste ne concerne pas le statut (ex. ENTREPRISE pour un salarié CESU).
 */
export const codeEtapeSchema = z.enum(["ORIENTATION", "PROFIL", "TELEPHONE", "IDENTITE", "ENTREPRISE", "ADRESSE", "PIECES", "DEMANDE", "APPEL_EQUIPE"]);

export const etapeSchema = z
  .object({
    code: codeEtapeSchema,
    libelle: z.string().max(200),
    faite: z.boolean(),
    /** Vrai si l'étape se fait seulement sur le site (communes, disponibilités, tarif, déclaration des pièces). */
    surLeSite: z.boolean(),
  })
  .strict();

export const etatVerificationSchema = z
  .object({
    validation: validationProfilSchema,
    /** Résultat de l'orientation enregistrée, null si elle n'est pas faite. */
    orientation: resultatOrientationSchema.nullable(),
    etapes: z.array(etapeSchema).max(10),
    /** Ce qui manque pour demander la vérification, en français simple (éléments que seul le site remplit). */
    manque: z.array(z.string().max(200)).max(20),
    /** Raison d'un refus ou d'une suspension, en français simple. */
    raison: z.string().max(300).nullable(),
    /** Vrai si la demande peut partir maintenant (orientation RECOMMANDE, rien ne manque, pas déjà envoyée). */
    peutDemander: z.boolean(),
  })
  .strict();
export type EtatVerification = z.infer<typeof etatVerificationSchema>;

/** POST /accompagnant/verification : corps vide. */
export const demandeVerificationSchema = z.object({}).strict();
export type DemandeVerification = z.infer<typeof demandeVerificationSchema>;
