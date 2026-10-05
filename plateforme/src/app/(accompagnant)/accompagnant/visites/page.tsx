import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getVisits } from "@/server/accompagnant/queries";
import { Alert } from "@/components/ui/alert";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { VisitRow } from "@/components/accompagnant/visit-display";
import { InstallPrompt } from "@/components/accompagnant/install-prompt";
import { relativeDay } from "@/components/famille/format";

export const metadata: Metadata = { title: "Mes visites" };

// A6 — Visites à venir / passées, Kayé à écrire.
export default async function Page({ searchParams }: { searchParams: Promise<{ acceptee?: string }> }) {
  const user = await requireRole("ACCOMPAGNANT");
  const { acceptee } = await searchParams;
  const { upcoming, past } = await getVisits(user.id);
  const accepted = acceptee !== undefined ? Number.parseInt(acceptee, 10) : null;
  const justAccepted = accepted !== null && Number.isFinite(accepted);
  const now = new Date();
  const today = upcoming.filter((v) => relativeDay(v.scheduledStart, now) === "aujourd'hui");
  const next = upcoming.filter((v) => relativeDay(v.scheduledStart, now) !== "aujourd'hui");

  return (
    <>
      <header className="mb-[18px]">
        <h1 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em]">Mes visites</h1>
        <p className="mt-1 text-[15px] leading-[1.45] text-muted">Le jour de la visite, ouvrez-la pour enregistrer votre arrivée.</p>
      </header>

      <div className="flex flex-col gap-4">
        {justAccepted ? (
          <Alert tone="succes" title="Mission acceptée">
            {accepted > 0
              ? `${accepted} visite${accepted > 1 ? "s sont planifiées" : " est planifiée"} sur les 4 prochaines semaines. La famille est prévenue.`
              : "La famille est prévenue. L'équipe Koudmen planifie les visites avec vous."}
          </Alert>
        ) : null}
        <InstallPrompt show={justAccepted} />

        {today.length > 0 ? (
          <section aria-labelledby="aujourdhui">
            <SectionHeader id="aujourdhui" title="Aujourd'hui" className="mt-2" />
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {today.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} showDate={false} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="a-venir">
          <SectionHeader id="a-venir" title="À venir" className="mt-2" />
          {next.length === 0 ? (
            <EmptyState
              title={today.length > 0 ? "Pas d'autre visite prévue" : "Aucune visite à venir"}
              action={
                <LinkButton href="/accompagnant/propositions" variant="quiet" size="lg" fullWidth>
                  Voir les propositions
                </LinkButton>
              }
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {next.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="passees">
          <SectionHeader id="passees" title="Passées" className="mt-2" />
          {past.length === 0 ? (
            <p className="mx-0.5 text-[15px] text-muted">Pas encore de visite passée.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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
