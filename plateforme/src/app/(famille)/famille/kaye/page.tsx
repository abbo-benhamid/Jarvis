import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { getFamilyAines, getKayeFeed } from "@/server/famille/queries";
import { groupByDay } from "@/server/famille/logic";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KayePreview } from "@/components/famille/kaye-card";
import { FilterTabs } from "@/components/famille/filter-tabs";
import { capitalize, dayLong } from "@/components/famille/format";
import { Term } from "@/components/ui/term";

export const metadata: Metadata = { title: "Kayé" };

type Props = { searchParams: Promise<{ aine?: string; signal?: string }> };

/** F8 : fil chronologique des Kayé (journal de visite) de tous les aînés du cercle. Chaque carte mène au détail. */
export default async function Page({ searchParams }: Props) {
  const user = await requireRole("FAMILLE");
  const sp = await searchParams;
  const aines = await getFamilyAines(user.id);
  const selected = aines.find((a) => a.id === sp.aine)?.id;
  const onlySignals = sp.signal === "1";
  const entries = await getKayeFeed(user.id, { aineId: selected, onlySignals });
  const groups = groupByDay(entries, (e) => e.visit.scheduledStart);
  const selectedName = aines.find((a) => a.id === selected)?.firstName;
  const now = new Date();

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
        description={
          <>
            Le <Term id="kaye" /> : après chaque visite, l&apos;accompagnant écrit quelques lignes. L&apos;humeur, ce que vous avez partagé,
            l&apos;appétit. Rien de médical.
          </>
        }
      />

      {aines.length === 0 ? (
        <EmptyState
          title="Le Kayé est vide pour le moment."
          action={
            <LinkButton href="/famille/aines/nouveau" size="lg" fullWidth>
              Ajouter un aîné
            </LinkButton>
          }
        >
          Ajoutez votre aîné et demandez un accompagnement. Après chaque visite, vous lisez ici des nouvelles.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
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
              <EmptyState title="Aucun point à surveiller.">
                Les accompagnants n&apos;ont rien signalé{selectedName ? ` pour ${selectedName}` : ""}.
              </EmptyState>
            ) : (
              <EmptyState
                title="Pas encore de Kayé."
                action={
                  <LinkButton href="/famille/visites" variant="quiet" size="lg" fullWidth>
                    Voir les visites
                  </LinkButton>
                }
              >
                Le premier arrive après la première visite.
              </EmptyState>
            )
          ) : (
            <ol className="m-0 flex list-none flex-col gap-6 p-0" aria-label="Kayé, du plus récent au plus ancien">
              {groups.map((g) => (
                <li key={g.day}>
                  <h2 className="mx-0.5 mb-2.5 text-[15px] leading-snug font-semibold text-muted">
                    {capitalize(dayLong(new Date(`${g.day}T16:00:00Z`)))}
                  </h2>
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {g.items.map((e) => (
                      <li key={e.id} id={`kaye-${e.id}`}>
                        <KayePreview entry={e} showAine={aines.length > 1} now={now} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {/* A7 : la micro-question vient APRÈS le Kayé lu. */}
          {entries.length > 0 ? <MicroQuestion user={user} questionKey="KAYE_RASSURE" path="/famille/kaye" /> : null}
        </div>
      )}
    </>
  );
}
