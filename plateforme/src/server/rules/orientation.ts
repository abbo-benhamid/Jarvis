/**
 * Orientation statut en 5 questions (docs/08 § 3.2 et § 3.3).
 * Fonction PURE : le Lot B construit l'écran, cette fonction donne le résultat.
 */
import type { CaregiverStatus, VerificationType } from "@prisma/client";
import { z } from "zod";
import { allowedLevelsFor, type Level } from "./status-levels";

export const orientationSchema = z.object({
  /** Q1 — Que voulez-vous faire ? (niveau visé 1 à 4) */
  activity: z.enum(["LIEN", "COUPS_DE_MAIN", "PRESENCE", "AIDE_RENFORCEE"]),
  /** Q2 — Voulez-vous être payé(e) ? */
  paid: z.boolean(),
  /** Q3 — Avez-vous déjà un statut professionnel ? */
  existingStatus: z.enum(["AUCUN", "AUTO_ENTREPRENEUR_SAP", "SALARIE_SAAD"]),
  /** Q4 — Situation aujourd'hui (plusieurs réponses). */
  situations: z
    .array(
      z.enum([
        "ETUDIANT",
        "RETRAITE",
        "DEMANDEUR_EMPLOI",
        "RSA",
        "TEMPS_PARTIEL",
        "AGENT_PUBLIC",
        "TITRE_SEJOUR_ETUDIANT",
      ]),
    )
    .default([]),
  /** Q5 — Lien familial avec la personne aidée ? */
  familyLink: z.enum(["AUCUN", "ENFANT_OU_PARENT", "CONJOINT"]),
});

export type OrientationAnswers = z.infer<typeof orientationSchema>;

export type OrientationOutcome =
  | "RECOMMANDE" // un statut est recommandé
  | "REFUSE" // aide régulière non payée hors bénévolat de lien
  | "LISTE_ATTENTE" // statut reporté (agent public, titre de séjour étudiant)
  | "ORIENTATION_EXTERNE"; // conjoint : PCH / AJPA, hors Koudmen

export type OrientationResult = {
  outcome: OrientationOutcome;
  status: CaregiverStatus | null;
  allowedLevels: Level[];
  /** Niveau visé à la Q1. */
  targetLevel: Level;
  /** Explication courte (STE) à afficher. */
  explanation: string;
  /** Règles de cumul et alertes. Elles n'empêchent pas l'inscription. */
  warnings: string[];
  requiredVerifications: VerificationType[];
};

const ACTIVITY_LEVEL: Record<OrientationAnswers["activity"], Level> = {
  LIEN: 1,
  COUPS_DE_MAIN: 2,
  PRESENCE: 3,
  AIDE_RENFORCEE: 4,
};

const CUMUL_WARNINGS: Partial<Record<OrientationAnswers["situations"][number], string>> = {
  ETUDIANT: "Étudiant : gardez du temps pour vos études. Vos heures comptent dans vos revenus déclarés.",
  // [À VÉRIFIER] règles de cumul emploi-retraite (marqueur interne, jamais affiché : S1b-ux M10).
  RETRAITE: "Retraité : vous pouvez travailler et toucher votre retraite. Demandez les règles à votre caisse de retraite.",
  DEMANDEUR_EMPLOI: "Demandeur d'emploi : déclarez vos heures chaque mois à France Travail.",
  RSA: "RSA : déclarez ces revenus à la CAF chaque trimestre.",
  TEMPS_PARTIEL: "Salarié à temps partiel : vérifiez la clause d'exclusivité de votre contrat.",
};

/** Pièces à vérifier selon le statut et les niveaux (docs/08 § 4.2). */
export function requiredVerificationsFor(status: CaregiverStatus, levels: readonly number[], targetLevel: number): VerificationType[] {
  const items: VerificationType[] = ["IDENTITE", "CASIER_B3"];
  if (status !== "BENEVOLE_ASSO") items.push("REFERENCES");
  items.push("FORMATION");
  if (status === "AUTO_ENTREPRENEUR_SAP" || status === "SAAD") items.push("STATUT_PRO");
  if (levels.includes(3) || targetLevel >= 3) items.push("PSC1");
  if (targetLevel === 4 && status !== "SAAD") items.push("DIPLOME");
  return items;
}

export function orientCaregiver(input: OrientationAnswers): OrientationResult {
  const answers = orientationSchema.parse(input);
  const targetLevel = ACTIVITY_LEVEL[answers.activity];
  const warnings: string[] = [];

  const result = (
    outcome: OrientationOutcome,
    status: CaregiverStatus | null,
    explanation: string,
  ): OrientationResult => {
    const allowedLevels = status ? allowedLevelsFor(status) : [];
    return {
      outcome,
      status,
      allowedLevels,
      targetLevel,
      explanation,
      warnings,
      requiredVerifications: status ? requiredVerificationsFor(status, allowedLevels, targetLevel) : [],
    };
  };

  // Q2 — non payé
  if (!answers.paid) {
    if (targetLevel === 1) {
      return result(
        "RECOMMANDE",
        "BENEVOLE_ASSO",
        "Vous aidez sans être payé(e). Vous rejoignez Koudmen via une association partenaire. Vous faites du lien : visites, appels, promenades.",
      );
    }
    return result(
      "REFUSE",
      null,
      "Une aide régulière se paie et se déclare. Choisissez d'être payé(e), ou faites du lien (niveau 1) comme bénévole.",
    );
  }

  // Q4 — statuts reportés
  if (answers.situations.includes("AGENT_PUBLIC") || answers.situations.includes("TITRE_SEJOUR_ETUDIANT")) {
    return result(
      "LISTE_ATTENTE",
      null,
      "Votre situation demande une démarche spéciale (autorisation de l'employeur public ou déclaration en préfecture). Nous vous inscrivons sur la liste d'attente.",
    );
  }
  for (const s of answers.situations) {
    const w = CUMUL_WARNINGS[s];
    if (w) warnings.push(w);
  }

  // Q3 — statut existant
  let status: CaregiverStatus;
  let explanation: string;
  if (answers.existingStatus === "SALARIE_SAAD") {
    status = "SAAD";
    explanation = "Vous travaillez pour un SAAD, un service d'aide à domicile. Ce service porte vos missions.";
  } else if (targetLevel === 4) {
    status = "SALARIE_FAMILLE_CESU";
    explanation =
      "L'aide renforcée demande un diplôme d'aide à la personne. La famille vous paie avec le CESU. Le niveau 4 s'ouvre quand l'équipe valide votre diplôme.";
  } else if (answers.existingStatus === "AUTO_ENTREPRENEUR_SAP" && targetLevel === 2) {
    status = "AUTO_ENTREPRENEUR_SAP";
    explanation =
      "Vous avez une micro-entreprise de services à la personne. Vous faites des coups de main (niveau 2) : courses, repas, papiers, numérique.";
  } else {
    status = "SALARIE_FAMILLE_CESU";
    explanation =
      "La famille vous emploie et vous paie avec le CESU. C'est le statut le plus simple et le plus sûr.";
    if (answers.existingStatus === "AUTO_ENTREPRENEUR_SAP") {
      warnings.push(
        "La compagnie et la présence ne se font pas en auto-entrepreneur. Pour ces missions, la famille vous emploie avec le CESU.",
      );
    }
  }

  // Q5 — lien familial
  if (answers.familyLink === "CONJOINT") {
    return result(
      "ORIENTATION_EXTERNE",
      null,
      "Un conjoint ne peut pas être payé avec l'aide autonomie du Département. D'autres aides existent pour les proches aidants : demandez-les au Département ou à la CAF.",
    );
  }
  if (answers.familyLink === "ENFANT_OU_PARENT" && status === "SALARIE_FAMILLE_CESU") {
    status = "PROCHE_AIDANT_APA";
    explanation =
      "Vous êtes un proche de la personne aidée. Vous pouvez être payé avec l'aide autonomie du Département. Vous êtes visible seulement dans son cercle Lakou.";
  }

  return result("RECOMMANDE", status, explanation);
}
