import type { Metadata } from "next";
import { ArrowRight, ClipboardCheck, Compass } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getProfile } from "@/server/accompagnant/queries";
import { PLANCHER_SALARIE_CENTS, availabilityKey, centsToEurosInput, statusIsSalaried } from "@/server/accompagnant/rules";
import { Avatar } from "@/components/ui/avatar";
import { CardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ProfileForm } from "@/components/accompagnant/profile-form";
import { CAREGIVER_STATUS_LABELS, VALIDATION_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Mon profil" };

// A3 — Profil : communes, disponibilités, tarif horaire LIBRE (RM-04).
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const profile = await getProfile(user.id);

  if (!profile.status) {
    return (
      <>
        <h1 className="mb-[18px] font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em]">Mon profil</h1>
        <EmptyState
          titleAs="h2"
          title="Faites d'abord l'orientation"
          action={
            <LinkButton href="/accompagnant/orientation" size="xl" fullWidth iconEnd={<ArrowRight strokeWidth={1.6} />}>
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
      <header className="mb-[18px] flex items-center gap-4">
        <Avatar name={user.firstName} size={56} role="accompagnant" />
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em]">Mon profil</h1>
          <p className="mt-1 text-[15px] text-muted">Tarif, communes et créneaux : vous décidez.</p>
        </div>
      </header>

      <ul className="m-0 mb-4 flex list-none flex-col gap-2.5 p-0">
        <li>
          <CardLink href="/accompagnant/orientation" padding="dense">
            <span className="flex items-center gap-3.5">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-soleil-soft text-soleil-ink">
                <Compass className="size-5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted">Mon statut</span>
                <b className="block font-semibold">{CAREGIVER_STATUS_LABELS[profile.status]}</b>
              </span>
            </span>
          </CardLink>
        </li>
        <li>
          <CardLink href="/accompagnant/verifications" padding="dense">
            <span className="flex items-center gap-3.5">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-feuille-soft text-feuille">
                <ClipboardCheck className="size-5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted">Mes vérifications</span>
                <b className="block font-semibold">{VALIDATION_LABELS[profile.validation]}</b>
              </span>
            </span>
          </CardLink>
        </li>
      </ul>

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
    </>
  );
}
