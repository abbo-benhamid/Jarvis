import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines } from "@/server/famille/queries";
import { todayIso } from "@/server/famille/schemas";
import { communeLabel } from "@/lib/communes";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { TopBar } from "@/components/famille/top-bar";
import { RequestForm } from "@/components/famille/request-form";

export const metadata: Metadata = { title: "Nouvelle demande" };

/** F6 : nouvelle demande d'accompagnement. */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine } = await searchParams;
  const aines = await getFamilyAines(user.id);

  return (
    <div className="flex flex-col">
      <TopBar title="Demander un accompagnement" backHref="/famille/demandes" backLabel="Retour aux demandes" />
      <p className="mb-5 text-[15px] leading-[1.45] text-muted">
        Décrivez le besoin. Koudmen vous propose ensuite 1 à 3 profils près de chez l&apos;aîné. Vous choisissez.
      </p>
      {aines.length === 0 ? (
        <EmptyState
          title="Ajoutez d'abord un aîné."
          action={
            <LinkButton href="/famille/aines/nouveau" size="lg" fullWidth icon={<Plus strokeWidth={1.6} />}>
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
