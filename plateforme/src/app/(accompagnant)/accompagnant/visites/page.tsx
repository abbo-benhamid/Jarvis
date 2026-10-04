import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getVisits } from "@/server/accompagnant/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { VisitRow } from "@/components/accompagnant/visit-display";

export const metadata: Metadata = { title: "Mes visites" };

// A6 — Visites à venir / passées, Kayé à écrire.
export default async function Page({ searchParams }: { searchParams: Promise<{ acceptee?: string }> }) {
  const user = await requireRole("ACCOMPAGNANT");
  const { acceptee } = await searchParams;
  const { upcoming, past } = await getVisits(user.id);
  const accepted = acceptee !== undefined ? Number.parseInt(acceptee, 10) : null;

  return (
    <>
      <PageHeader eyebrow="Visites" title="Mes visites" description="Le jour de la visite, ouvrez-la pour faire le check-in." />
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {accepted !== null && Number.isFinite(accepted) ? (
          <Alert tone="succes" title="Mission acceptée">
            {accepted > 0
              ? `${accepted} visite${accepted > 1 ? "s sont planifiées" : " est planifiée"} sur les 4 prochaines semaines. La famille est prévenue.`
              : "La famille est prévenue. L'équipe Koudmen planifie les visites avec vous."}
          </Alert>
        ) : null}

        <section aria-labelledby="a-venir" className="flex flex-col gap-3">
          <h2 id="a-venir" className="text-2xl font-bold">
            À venir
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title="Aucune visite à venir"
              action={
                <LinkButton href="/accompagnant/propositions" variant="secondary">
                  Voir les propositions
                </LinkButton>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="passees" className="flex flex-col gap-3">
          <h2 id="passees" className="text-2xl font-bold">
            Passées
          </h2>
          {past.length === 0 ? (
            <p className="text-muted">Pas encore de visite passée.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {past.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
