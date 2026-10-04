import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines } from "@/server/famille/queries";
import { todayIso } from "@/server/famille/schemas";
import { communeLabel } from "@/lib/communes";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { RequestForm } from "@/components/famille/request-form";

export const metadata: Metadata = { title: "Nouvelle demande" };

/** F6 : nouvelle demande d'accompagnement. */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine } = await searchParams;
  const aines = await getFamilyAines(user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        eyebrow="Demandes"
        title="Demander un accompagnement"
        description="Décrivez le besoin. Koudmen vous propose ensuite 1 à 3 profils près de chez l'aîné. Vous choisissez."
      />
      {aines.length === 0 ? (
        <EmptyState
          title="Ajoutez d'abord un aîné"
          action={
            <LinkButton href="/famille/aines/nouveau">
              <Plus aria-hidden="true" className="size-4" />
              Ajouter un aîné
            </LinkButton>
          }
        >
          Une demande concerne toujours un aîné de votre cercle Lakou.
        </EmptyState>
      ) : (
        <RequestForm
          aines={aines.map((a) => ({
            id: a.id,
            firstName: a.firstName,
            lastInitial: a.lastInitial,
            activityLevel: a.activityLevel,
            communeLabel: communeLabel(a.commune),
          }))}
          defaultAineId={aine}
          today={todayIso()}
        />
      )}
    </div>
  );
}
