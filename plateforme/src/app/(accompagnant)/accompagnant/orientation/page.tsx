import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getProfile } from "@/server/accompagnant/queries";
import { canRedoOrientation } from "@/server/accompagnant/rules";
import { orientCaregiver, orientationSchema, type OrientationResult } from "@/server/rules/orientation";
import { isLevel } from "@/server/rules/status-levels";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/status-badges";
import { CAREGIVER_STATUS_LABELS } from "@/lib/labels";
import { OrientationWizard } from "@/components/accompagnant/orientation-wizard";

export const metadata: Metadata = { title: "Mon statut en 5 questions" };

// A2 — Orientation statut (spec § 3.1 et § 5.3).
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const profile = await getProfile(user.id);

  let initialResult: OrientationResult | null = null;
  const stored = orientationSchema.safeParse(profile.orientationAnswers);
  if (stored.success) {
    initialResult = orientCaregiver(stored.data);
    // Niveaux réels du profil (ex. niveau 4 ouvert après validation du diplôme).
    if (initialResult.status && initialResult.status === profile.status) {
      initialResult = { ...initialResult, allowedLevels: profile.allowedLevels.filter(isLevel) };
    }
  }
  const canRedo = canRedoOrientation(profile.validation);

  return (
    <>
      <PageHeader
        eyebrow="Mon statut"
        title="Mon statut en 5 questions"
        description="Répondez à 5 questions courtes. Koudmen vous indique le statut le plus simple et le plus sûr pour vous."
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {!canRedo ? (
          <Alert tone="info">
            Votre profil est validé. Pour changer de statut, écrivez à l&apos;équipe Koudmen avec le bouton « Donner mon avis ».
          </Alert>
        ) : profile.validation === "EN_ATTENTE" ? (
          <Alert tone="attention">
            Votre profil est en cours de vérification. Si vous refaites l&apos;orientation, vous devrez redemander la vérification.
          </Alert>
        ) : null}
        {!canRedo && !initialResult ? (
          <Card className="flex flex-col gap-3">
            <CardTitle>Votre statut</CardTitle>
            <p className="text-2xl font-bold text-mer">
              {profile.status ? CAREGIVER_STATUS_LABELS[profile.status] : "Non défini"}
            </p>
            <ul className="flex flex-wrap gap-2">
              {profile.allowedLevels.map((l) => (
                <li key={l}>
                  <LevelBadge level={l} />
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <OrientationWizard initialResult={initialResult} canRedo={canRedo} />
        )}
      </div>
    </>
  );
}
