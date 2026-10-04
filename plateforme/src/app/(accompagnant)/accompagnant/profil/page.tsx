import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getProfile } from "@/server/accompagnant/queries";
import { PLANCHER_SALARIE_CENTS, availabilityKey, centsToEurosInput, statusIsSalaried } from "@/server/accompagnant/rules";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ValidationBadge } from "@/components/status-badges";
import { ProfileForm } from "@/components/accompagnant/profile-form";
import { CAREGIVER_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Mon profil" };

// A3 — Profil : communes, disponibilités, tarif horaire LIBRE (RM-04).
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const profile = await getProfile(user.id);

  if (!profile.status) {
    return (
      <>
        <PageHeader eyebrow="Mon profil" title="Mon profil" />
        <EmptyState
          title="Faites d'abord l'orientation"
          action={
            <LinkButton href="/accompagnant/orientation" size="lg">
              Commencer (5 questions)
            </LinkButton>
          }
        >
          <p>Votre statut décide de votre tarif et de vos missions. Il faut 2 minutes.</p>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Mon profil"
        title="Mon profil"
        description={`Statut : ${CAREGIVER_STATUS_LABELS[profile.status]}.`}
        actions={<ValidationBadge status={profile.validation} />}
      />
      <div className="mx-auto max-w-3xl">
        <ProfileForm
          status={profile.status}
          smicCents={statusIsSalaried(profile.status) ? PLANCHER_SALARIE_CENTS : null}
          initial={{
            communes: profile.communes,
            availabilities: profile.availabilities.map(availabilityKey),
            hourlyRate: centsToEurosInput(profile.hourlyRateCents),
            bio: profile.bio ?? "",
            associationName: profile.associationName ?? "",
            saadName: profile.saadName ?? "",
            siret: profile.siret ?? "",
          }}
        />
      </div>
    </>
  );
}
