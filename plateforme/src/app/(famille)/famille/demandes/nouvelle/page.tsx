import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines } from "@/server/famille/queries";
import { todayIso } from "@/server/famille/schemas";
import { communeLabel } from "@/lib/communes";
import { deName } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { TopBar } from "@/components/famille/top-bar";
import { RequestForm } from "@/components/famille/request-form";

export const metadata: Metadata = { title: "Nouvelle demande" };

/** F6 : nouvelle demande d'accompagnement. */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine } = await searchParams;
  const all = await getFamilyAines(user.id);
  // M5 : seulement les aînés qui ont donné leur accord. Jamais un formulaire refusé d'avance.
  const aines = all.filter((a) => a.accordEtat === "ACCORD_RECUEILLI");
  const waiting = all.filter((a) => a.accordEtat === "EN_ATTENTE_ACCORD");

  return (
    <div className="flex flex-col">
      <TopBar title="Demander un accompagnement" backHref="/famille/demandes" backLabel="Retour aux demandes" />
      <p className="mb-5 text-[15px] leading-[1.45] text-muted">
        Décrivez le besoin. Koudmen vous propose ensuite 1 à 3 profils près de chez l&apos;aîné. Vous choisissez.
      </p>
      {aines.length === 0 && waiting.length > 0 ? (
        <EmptyState
          title={`Disponible après l'accord ${deName(waiting[0]!.firstName)}.`}
          action={
            <LinkButton href={`/famille/aines/${waiting[0]!.id}`} size="lg" fullWidth variant="quiet">
              Voir la fiche
            </LinkButton>
          }
        >
          Un conseiller Koudmen appelle {waiting.map((a) => a.firstName).join(" et ")} pour recueillir son accord. Ensuite, vous pourrez demander un
          accompagnement.
        </EmptyState>
      ) : aines.length === 0 && all.length > 0 ? (
        <EmptyState title="Aucune demande possible.">L&apos;aîné n&apos;a pas donné son accord. Koudmen respecte ce choix.</EmptyState>
      ) : aines.length === 0 ? (
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
