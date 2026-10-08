import "server-only";
import type { CaregiverValidation, VerificationStatus, VerificationType } from "@prisma/client";
import { orientCaregiver, orientationSchema, type OrientationResult } from "@/server/rules/orientation";
import { VERIFICATION_TYPE_LABELS } from "@/lib/labels";
import type { DemandeOrientation, EtatVerification, ResultatOrientation } from "@/contracts/v1/accompagnant";
import { itemReadyForSubmission, isL2Type, type L2Type } from "@/server/verifications/rules";
import { ensureRequiredItems, l2Applies, loadProfile, requiredFor, submissionProblems } from "@/server/verifications/service";
import { AccompagnantError, getOrCreateProfile, saveOrientation, submitForReview, type Actor } from "./service";
import { missingProfileItems, type ProfileSnapshot } from "./rules";

/**
 * L1d (D15) : orientation et demande de vérification de l'accompagnant DANS l'app (API v1).
 * Mêmes services que le site (`saveOrientation`, `submitForReview`) : mêmes règles, mêmes journaux.
 * L2 : étapes TELEPHONE, IDENTITE, ENTREPRISE, ADRESSE (faisables dans l'app : `/accompagnant/verifications/*`).
 * Ce qui se remplit seulement sur le site (communes, disponibilités, tarif, déclarations) est listé dans `manque`.
 */

/** Résultat du site → contrat v1 (français). */
export function toResultatOrientation(r: OrientationResult): ResultatOrientation {
  return {
    issue: r.outcome,
    statut: r.status,
    explication: r.explanation.slice(0, 600),
    avertissements: r.warnings.slice(0, 10).map((w) => w.slice(0, 600)),
    pieces: r.requiredVerifications.filter((t): t is ResultatOrientation["pieces"][number] => !isL2Type(t) || t === "IDENTITE").slice(0, 10),
    niveaux: [...r.allowedLevels],
  };
}

type ProfileForState = ProfileSnapshot & {
  validation: CaregiverValidation;
  validationReason: string | null;
  orientationAnswers: unknown;
  allowedLevels: number[];
  verifications: { type: VerificationType; status: VerificationStatus }[];
};

/** Résultat de l'orientation enregistrée. Après la validation, les réponses sont effacées (R6) : statut seul. */
function storedOrientation(p: ProfileForState): ResultatOrientation | null {
  const answers = orientationSchema.safeParse(p.orientationAnswers);
  if (answers.success) return toResultatOrientation(orientCaregiver(answers.data));
  if (!p.status) return null;
  return { issue: "RECOMMANDE", statut: p.status, explication: "Votre statut est enregistré.", avertissements: [], pieces: [], niveaux: p.allowedLevels.filter((n) => n >= 1 && n <= 4).slice(0, 4) };
}

const L2_STEPS: { code: L2Type; libelle: string }[] = [
  { code: "TELEPHONE", libelle: "Vérifier votre numéro de téléphone" },
  { code: "IDENTITE", libelle: "Vérifier votre identité" },
  { code: "ENTREPRISE", libelle: "Vérifier votre entreprise (SIRET)" },
  { code: "ADRESSE", libelle: "Vérifier votre adresse" },
];

/**
 * État pur (testable) à partir du profil.
 * `l2` : éléments L2 requis (monde réel). Vide dans le bac à sable : l'identité reste une pièce déclarée (L1).
 * `problems` : ce qui empêche la demande (calculé par `submissionProblems`), ou null pour l'ancienne règle.
 */
export function verificationState(p: ProfileForState, l2: readonly L2Type[] = [], problems: string[] | null = null): EtatVerification {
  const orientation = storedOrientation(p);
  const missingProfile = missingProfileItems(p).filter((m) => m.key !== "status").map((m) => `${m.label} (sur le site)`);
  const declarations = p.verifications.filter((v) => !l2.includes(v.type as L2Type));
  const toDeclare = declarations.filter((v) => v.status !== "DECLARE" && v.status !== "VALIDE").map((v) => VERIFICATION_TYPE_LABELS[v.type]);
  const l2Missing = l2.filter((t) => !itemReadyForSubmission(p.verifications.find((v) => v.type === t)?.status ?? "A_FOURNIR"));
  const manque = [
    ...missingProfile,
    ...l2Missing.map((t) => L2_STEPS.find((s) => s.code === t)!.libelle),
    ...(toDeclare.length > 0 ? [`Déclarer : ${toDeclare.join(", ")} (sur le site)`.slice(0, 200)] : []),
  ];
  const sent = p.validation === "EN_ATTENTE" || p.validation === "VALIDE" || p.validation === "A_COMPLETER" || p.validation === "EXPIRE";
  const recommended = orientation?.issue === "RECOMMANDE";
  const open = p.validation === "BROUILLON" || p.validation === "REFUSE";
  return {
    validation: p.validation,
    orientation,
    etapes: [
      { code: "ORIENTATION", libelle: "Répondre aux 5 questions", faite: recommended, surLeSite: false },
      { code: "PROFIL", libelle: "Communes, disponibilités et tarif", faite: recommended && missingProfile.length === 0, surLeSite: true },
      ...L2_STEPS.filter((s) => l2.includes(s.code)).map((s) => ({ code: s.code, libelle: s.libelle, faite: !l2Missing.includes(s.code), surLeSite: false })),
      { code: "PIECES", libelle: "Déclarer vos pièces", faite: recommended && p.verifications.length > 0 && toDeclare.length === 0, surLeSite: true },
      { code: "DEMANDE", libelle: "Demander la vérification", faite: sent, surLeSite: false },
      { code: "APPEL_EQUIPE", libelle: "Appel de l'équipe Koudmen, puis validation", faite: p.validation === "VALIDE", surLeSite: false },
    ],
    manque: recommended && open ? manque.slice(0, 20) : [],
    raison: p.validation === "REFUSE" || p.validation === "SUSPENDU" ? (p.validationReason?.slice(0, 300) ?? null) : null,
    peutDemander: recommended && open && (problems ? problems.length === 0 : manque.length === 0),
  };
}

export async function getVerificationState(userId: string): Promise<EtatVerification> {
  const base = await getOrCreateProfile(userId);
  const vp = await loadProfile(userId);
  const items = await ensureRequiredItems(vp);
  const l2 = l2Applies(vp.user) ? requiredFor(vp, items).filter((t): t is L2Type => isL2Type(t)) : [];
  const problems = submissionProblems(vp, items, base.availabilities.length);
  return verificationState({ ...base, verifications: items, availabilityCount: base.availabilities.length }, l2, problems);
}

/** POST /accompagnant/orientation : enregistre les 5 réponses (mêmes règles que le site). */
export async function saveOrientationFromApp(actor: Actor, answers: DemandeOrientation): Promise<ResultatOrientation> {
  const r = await saveOrientation(actor, { ...answers, situations: [...new Set(answers.situations)] });
  return toResultatOrientation(r);
}

/** POST /accompagnant/verification : demande la vérification (mêmes contrôles que le site), puis renvoie l'état. */
export async function requestVerificationFromApp(actor: Actor): Promise<EtatVerification> {
  const p = await getOrCreateProfile(actor.id);
  if (p.validation === "EN_ATTENTE" || p.validation === "VALIDE" || p.validation === "A_COMPLETER") throw new AccompagnantError("Votre demande est déjà envoyée.", "CONFLIT");
  if (p.validation === "SUSPENDU") throw new AccompagnantError("Votre profil est suspendu. Contactez l'équipe Koudmen.", "INTERDIT");
  await submitForReview(actor);
  return getVerificationState(actor.id);
}
