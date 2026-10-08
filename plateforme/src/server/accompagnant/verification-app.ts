import "server-only";
import type { CaregiverValidation, VerificationStatus, VerificationType } from "@prisma/client";
import { orientCaregiver, orientationSchema, type OrientationResult } from "@/server/rules/orientation";
import { VERIFICATION_TYPE_LABELS } from "@/lib/labels";
import type { DemandeOrientation, EtatVerification, ResultatOrientation } from "@/contracts/v1/accompagnant";
import { AccompagnantError, getOrCreateProfile, saveOrientation, submitForReview, type Actor } from "./service";
import { canSubmitForReview, missingProfileItems, type ProfileSnapshot } from "./rules";

/**
 * L1d (D15) : orientation et demande de vérification de l'accompagnant DANS l'app (API v1).
 * Mêmes services que le site (`saveOrientation`, `submitForReview`) : mêmes règles, mêmes journaux.
 * Ce qui se remplit seulement sur le site (communes, disponibilités, tarif, déclaration des pièces) est listé
 * dans `manque` ; l'opérateur voit ces comptes dans la file « Accompagnants à appeler » (files-lancement.ts).
 */

/** Résultat du site → contrat v1 (français). */
export function toResultatOrientation(r: OrientationResult): ResultatOrientation {
  return {
    issue: r.outcome,
    statut: r.status,
    explication: r.explanation.slice(0, 600),
    avertissements: r.warnings.slice(0, 10).map((w) => w.slice(0, 600)),
    pieces: r.requiredVerifications.slice(0, 10),
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

/** État pur (testable) à partir du profil. */
export function verificationState(p: ProfileForState): EtatVerification {
  const orientation = storedOrientation(p);
  const missingProfile = missingProfileItems(p).filter((m) => m.key !== "status").map((m) => `${m.label} (sur le site)`);
  const toDeclare = p.verifications.filter((v) => v.status !== "DECLARE" && v.status !== "VALIDE").map((v) => VERIFICATION_TYPE_LABELS[v.type]);
  const manque = [...missingProfile, ...(toDeclare.length > 0 ? [`Déclarer : ${toDeclare.join(", ")} (sur le site)`.slice(0, 200)] : [])];
  const sent = p.validation === "EN_ATTENTE" || p.validation === "VALIDE";
  const recommended = orientation?.issue === "RECOMMANDE";
  return {
    validation: p.validation,
    orientation,
    etapes: [
      { code: "ORIENTATION", libelle: "Répondre aux 5 questions", faite: recommended, surLeSite: false },
      { code: "PROFIL", libelle: "Communes, disponibilités et tarif", faite: recommended && missingProfile.length === 0, surLeSite: true },
      { code: "PIECES", libelle: "Déclarer vos pièces", faite: recommended && p.verifications.length > 0 && toDeclare.length === 0, surLeSite: true },
      { code: "DEMANDE", libelle: "Demander la vérification", faite: sent, surLeSite: false },
      { code: "APPEL_EQUIPE", libelle: "Appel de l'équipe Koudmen, puis validation", faite: p.validation === "VALIDE", surLeSite: false },
    ],
    manque: recommended ? manque.slice(0, 20) : [],
    raison: p.validation === "REFUSE" || p.validation === "SUSPENDU" ? (p.validationReason?.slice(0, 300) ?? null) : null,
    peutDemander: recommended && canSubmitForReview(p.validation, p, p.verifications),
  };
}

export async function getVerificationState(userId: string): Promise<EtatVerification> {
  const p = await getOrCreateProfile(userId);
  return verificationState({ ...p, availabilityCount: p.availabilities.length });
}

/** POST /accompagnant/orientation : enregistre les 5 réponses (mêmes règles que le site). */
export async function saveOrientationFromApp(actor: Actor, answers: DemandeOrientation): Promise<ResultatOrientation> {
  const r = await saveOrientation(actor, { ...answers, situations: [...new Set(answers.situations)] });
  return toResultatOrientation(r);
}

/** POST /accompagnant/verification : demande la vérification (mêmes contrôles que le site), puis renvoie l'état. */
export async function requestVerificationFromApp(actor: Actor): Promise<EtatVerification> {
  const p = await getOrCreateProfile(actor.id);
  if (p.validation === "EN_ATTENTE" || p.validation === "VALIDE") throw new AccompagnantError("Votre demande est déjà envoyée.", "CONFLIT");
  if (p.validation === "SUSPENDU") throw new AccompagnantError("Votre profil est suspendu. Contactez l'équipe Koudmen.", "INTERDIT");
  await submitForReview(actor);
  return getVerificationState(actor.id);
}
