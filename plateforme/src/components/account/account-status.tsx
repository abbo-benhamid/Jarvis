import type { CurrentUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Alert } from "@/components/ui/alert";
import { VALIDATION_DELAY_DAYS } from "@/lib/legal-launch";
import { ResendVerificationButton } from "./resend-verification";

/** L2 : profil accompagnant validé ? (aussi utilisé par GET /api/v1/me). */
export function caregiverProfileValidated(validation: string | null | undefined): boolean {
  return validation === "VALIDE";
}

/**
 * L2 / L3 : bandeaux d'état du compte, en tête des espaces famille et accompagnant.
 * - E-mail pas encore confirmé → « Confirmez votre adresse e-mail » + renvoi du lien.
 * - Accompagnant pas encore validé → « Profil en cours de validation » (délai affiché, J28).
 * Rien pour un compte démo ou de bac à sable.
 */
export async function AccountStatus({ user }: { user: CurrentUser }) {
  if (user.isDemo || user.sandboxId) return null;
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true, caregiverProfile: { select: { validation: true } } },
  });
  if (!row) return null;
  const validation = row.caregiverProfile?.validation ?? null;
  const pendingProfile = user.role === "ACCOMPAGNANT" && !caregiverProfileValidated(validation);
  if (row.emailVerifiedAt && !pendingProfile) return null;
  return (
    <div className="mb-4 flex flex-col gap-3" data-testid="etat-compte">
      {!row.emailVerifiedAt ? (
        <Alert tone="attention" title="Confirmez votre adresse e-mail">
          Ouvrez l&apos;e-mail de Koudmen, puis appuyez sur « Confirmer mon adresse ».
          <ResendVerificationButton />
        </Alert>
      ) : null}
      {pendingProfile ? (
        <Alert tone="info" title="Profil en cours de validation">
          {validation === "EN_ATTENTE"
            ? `L'équipe Koudmen vérifie votre profil. Réponse en ${VALIDATION_DELAY_DAYS} jours au plus.`
            : validation === "REFUSE" || validation === "SUSPENDU"
              ? "Votre profil n'est pas validé. Le motif est écrit plus bas. Vous pouvez demander un réexamen à l'équipe."
              : "Complétez votre profil, puis demandez la vérification. Vous recevez des propositions seulement après la validation."}
        </Alert>
      ) : null}
    </div>
  );
}
