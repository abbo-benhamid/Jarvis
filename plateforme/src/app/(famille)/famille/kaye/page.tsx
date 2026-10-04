import type { Metadata } from "next";
import { Eye, NotebookPen } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { getFamilyAines, getKayeFeed } from "@/server/famille/queries";
import { groupByDay } from "@/server/famille/logic";
import { MARTINIQUE_TZ } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KayeCard } from "@/components/famille/kaye-card";
import { FilterTabs } from "@/components/famille/filter-tabs";

export const metadata: Metadata = { title: "Kayé" };

const dayHeading = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: MARTINIQUE_TZ });

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
}

type Props = { searchParams: Promise<{ aine?: string; signal?: string }> };

/** F8 : fil chronologique des Kayé (journal de visite) de tous les aînés du cercle. */
export default async function Page({ searchParams }: Props) {
  const user = await requireRole("FAMILLE");
  const sp = await searchParams;
  const aines = await getFamilyAines(user.id);
  const selected = aines.find((a) => a.id === sp.aine)?.id;
  const onlySignals = sp.signal === "1";
  const entries = await getKayeFeed(user.id, { aineId: selected, onlySignals });
  const groups = groupByDay(entries, (e) => e.visit.scheduledStart);
  const selectedName = aines.find((a) => a.id === selected)?.firstName;

  const href = (aine?: string, signal?: boolean) => {
    const q = new URLSearchParams();
    if (aine) q.set("aine", aine);
    if (signal) q.set("signal", "1");
    const s = q.toString();
    return s ? `/famille/kaye?${s}` : "/famille/kaye";
  };

  return (
    <>
      <PageHeader
        eyebrow="Kayé"
        title="Le cahier des visites"
        description="Après chaque visite, l'accompagnant écrit quelques lignes : l'humeur, ce que vous avez partagé, l'appétit. Rien de médical."
      />

      {aines.length === 0 ? (
        <EmptyState
          title="Le Kayé est vide pour le moment"
          action={<LinkButton href="/famille/aines/nouveau">Ajouter un aîné</LinkButton>}
        >
          Ajoutez votre aîné et demandez un accompagnement. Après chaque visite, vous lisez ici des nouvelles.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {entries.length > 0 ? <MicroQuestion user={user} questionKey="KAYE_RASSURE" path="/famille/kaye" /> : null}
          <div className="flex flex-col gap-2">
            {aines.length > 1 ? (
              <FilterTabs
                label="Filtrer par aîné"
                tabs={[
                  { href: href(undefined, onlySignals), label: "Tous", active: !selected },
                  ...aines.map((a) => ({ href: href(a.id, onlySignals), label: a.firstName, active: selected === a.id })),
                ]}
              />
            ) : null}
            <FilterTabs
              label="Type de Kayé"
              tabs={[
                { href: href(selected, false), label: "Tout le Kayé", active: !onlySignals },
                { href: href(selected, true), label: "À surveiller seulement", active: onlySignals },
              ]}
            />
          </div>

          {entries.length === 0 ? (
            onlySignals ? (
              <EmptyState title="Aucun point à surveiller">
                <span className="inline-flex items-center gap-2">
                  <Eye aria-hidden="true" className="size-4" />
                  Les accompagnants n&apos;ont rien signalé{selectedName ? ` pour ${selectedName}` : ""}.
                </span>
              </EmptyState>
            ) : (
              <EmptyState title="Pas encore de Kayé" action={<LinkButton href="/famille/visites" variant="secondary">Voir les visites</LinkButton>}>
                <span className="inline-flex items-center gap-2">
                  <NotebookPen aria-hidden="true" className="size-4" />
                  Le premier Kayé arrive après la première visite.
                </span>
              </EmptyState>
            )
          ) : (
            <ol className="flex flex-col gap-8" aria-label="Kayé, du plus récent au plus ancien">
              {groups.map((g) => (
                <li key={g.day} className="flex flex-col gap-3">
                  <h2 className="sticky top-0 z-10 -mx-1 bg-bg/95 px-1 py-1 text-lg font-bold text-muted">
                    {capitalize(dayHeading.format(new Date(`${g.day}T16:00:00Z`)))}
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {g.items.map((e) => (
                      <li key={e.id}>
                        <KayeCard entry={e} showAine={aines.length > 1} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}
