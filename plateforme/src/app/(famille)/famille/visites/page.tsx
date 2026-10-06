import type { Metadata } from "next";
import { BookOpen, KeyRound, MapPin, PhoneCall } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { getFamilyAines, getFamilyVisits } from "@/server/famille/queries";
import { displayVisitStatus, splitVisits } from "@/server/famille/logic";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Card, DateBox, SectionHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VisitStatusBadge } from "@/components/status-badges";
import { ProofFactors } from "@/components/famille/proof-factors";
import { FilterTabs } from "@/components/famille/filter-tabs";
import { capitalize, dayLong, dayNumber, hourLabel, weekdayShort } from "@/components/famille/format";
import { Term } from "@/components/ui/term";

export const metadata: Metadata = { title: "Visites" };

type VisitRow = Awaited<ReturnType<typeof getFamilyVisits>>[number];

/**
 * F7 : visites à venir et passées, preuve 2 sur 3.
 * A5 : la famille ne confirme JAMAIS une visite. Elle voit seulement le résultat de l'appel à l'aîné.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine: aineFilter } = await searchParams;
  const aines = await getFamilyAines(user.id);
  const selected = aines.find((a) => a.id === aineFilter)?.id;
  const visits = await getFamilyVisits(user.id, selected);
  const now = new Date();
  // Le statut est déjà à jour en base (sweepOverdueVisits, cohérent pour tous les espaces). Recalcul = filet de sécurité.
  const { upcoming, past } = splitVisits(
    visits.map((v) => ({ ...v, status: displayVisitStatus(v, now) })),
    now,
  );

  return (
    <>
      <PageHeader
        eyebrow="Visites"
        title="Les visites"
        description={
          <>
            Chaque visite a une <Term id="preuve">preuve de visite</Term>. Il faut 2 preuves sur 3 pour la valider.
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <ProofExplainer>
          {/* A7 : la micro-question apparaît APRÈS l'ouverture de l'explication. */}
          {visits.length > 0 ? <MicroQuestion user={user} questionKey="PREUVE_COMPRISE" path="/famille/visites" /> : null}
        </ProofExplainer>

        {aines.length > 1 ? (
          <FilterTabs
            label="Filtrer par aîné"
            tabs={[
              { href: "/famille/visites", label: "Tous", active: !selected },
              ...aines.map((a) => ({ href: `/famille/visites?aine=${a.id}`, label: a.firstName, active: selected === a.id })),
            ]}
          />
        ) : null}
      </div>

      {visits.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Aucune visite pour le moment."
          action={
            aines.length > 0 ? (
              <LinkButton href="/famille/demandes/nouvelle" size="lg" fullWidth>
                Demander un accompagnement
              </LinkButton>
            ) : (
              <LinkButton href="/famille/aines/nouveau" size="lg" fullWidth>
                Ajouter un aîné
              </LinkButton>
            )
          }
        >
          Les visites apparaissent ici quand un accompagnant accepte une demande.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="a-venir">
            <SectionHeader id="a-venir" title={`À venir et en cours (${upcoming.length})`} />
            {upcoming.length === 0 ? (
              <p className="mx-0.5 text-[15px] text-muted">Aucune visite prévue.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {upcoming.map((v) => (
                  <VisitItem key={v.id} v={v} showAine={aines.length > 1} />
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="passees">
            <SectionHeader id="passees" title={`Passées (${past.length})`} />
            {past.length === 0 ? (
              <p className="mx-0.5 text-[15px] text-muted">Aucune visite passée.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {past.map((v) => (
                  <VisitItem key={v.id} v={v} showAine={aines.length > 1} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function VisitItem({ v, showAine }: { v: VisitRow; showAine: boolean }) {
  return (
    <li>
      <Card as="article" aria-label={`Visite du ${dayLong(v.scheduledStart)}`} className="flex flex-col gap-3.5">
        <div className="flex items-start gap-4">
          <DateBox day={weekdayShort(v.scheduledStart)} date={dayNumber(v.scheduledStart)} label={dayLong(v.scheduledStart)} />
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
              {hourLabel(v.scheduledStart)} – {hourLabel(v.scheduledEnd)} · avec {v.caregiver.user.firstName}
            </h3>
            <p className="text-[15px] leading-[1.4] text-muted">
              {capitalize(dayLong(v.scheduledStart))}
              {showAine ? `, chez ${v.aine.firstName}` : null}
            </p>
            <div className="mt-2">
              <VisitStatusBadge status={v.status} />
            </div>
          </div>
        </div>
        {v.status === "PREVUE" ? (
          <p className="text-[15px] text-muted">Les preuves arrivent pendant la visite.</p>
        ) : (
          <div className="border-t border-line pt-3">
            <ProofFactors proofs={v.proofs} finished={v.status !== "EN_COURS"} />
          </div>
        )}
        {v.status === "A_VERIFIER" ? (
          <p className="rounded-md bg-soleil-soft p-3.5 text-[15px] leading-[1.45]">
            <strong>À vérifier :</strong> il manque une preuve. Koudmen appelle {v.aine.firstName} pour confirmer la visite, puis l&apos;équipe
            Koudmen vérifie. Vous n&apos;avez rien à faire.
          </p>
        ) : null}
        {v.journal ? (
          <LinkButton href={`/famille/kaye/${v.journal.id}`} variant="quiet" size="lg" fullWidth icon={<BookOpen strokeWidth={1.6} />}>
            Lire le Kayé de cette visite
          </LinkButton>
        ) : null}
      </Card>
    </li>
  );
}

/** Schéma de la preuve « 2 sur 3 ». Le testeur l'ouvre avant la question. */
function ProofExplainer({ children }: { children?: React.ReactNode }) {
  const items = [
    { icon: MapPin, title: "Position à l'arrivée", text: "L'accompagnant partage sa position une seule fois, à l'arrivée." },
    { icon: KeyRound, title: "Code du domicile", text: "Il scanne le QR code ou saisit le code affiché chez l'aîné." },
    { icon: PhoneCall, title: "Confirmation de l'aîné", text: "Koudmen appelle l'aîné. Il tape 1 pour confirmer la visite (simulé dans la démo)." },
  ];
  return (
    <details className="group rounded-card bg-surface px-5 shadow-card">
      <summary className="flex min-h-14 cursor-pointer items-center py-3 text-[17px] font-semibold">Comment Koudmen prouve une visite{"\u202f"}?</summary>
      <ol className="m-0 flex list-none flex-col gap-3 p-0 pb-4">
        {items.map((it) => (
          <li key={it.title} className="flex gap-3">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-mer-soft text-mer">
              <it.icon className="size-5" strokeWidth={1.6} />
            </span>
            <div>
              <p className="font-semibold">{it.title}</p>
              <p className="text-[15px] leading-[1.4] text-muted">{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mb-4 rounded-md bg-feuille-soft p-3.5 text-[15px] text-fg">
        <strong>2 preuves sur 3 = visite validée.</strong> Sinon, la visite passe « À vérifier » et l&apos;équipe Koudmen contrôle.
      </p>
      {children ? <div className="pb-4">{children}</div> : null}
    </details>
  );
}
