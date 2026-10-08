import type { Metadata } from "next";
import { BookOpen, KeyRound, MapPin, Navigation, PhoneCall } from "lucide-react";
import { VisitReviewForm } from "@/components/presence/visit-review-form";
import { tripViewableAineIds } from "@/server/presence/queries";
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
import { isLaunchMode } from "@/server/launch";

export const metadata: Metadata = { title: "Visites" };

type VisitRow = Awaited<ReturnType<typeof getFamilyVisits>>[number];

/**
 * F7 : visites à venir et passées, preuve 2 sur 3.
 * L1-B (R7, remplace A5) : la famille EMPLOYEUR tranche une visite « À vérifier » (confirmer ou signaler).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine: aineFilter } = await searchParams;
  const aines = await getFamilyAines(user.id);
  const selected = aines.find((a) => a.id === aineFilter)?.id;
  const visits = await getFamilyVisits(user.id, selected);
  const employerIds = new Set(aines.filter((a) => a.isPayer).map((a) => a.id));
  const followIds = await tripViewableAineIds(user.id);
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
                  <VisitItem key={v.id} v={v} showAine={aines.length > 1} employer={employerIds.has(v.aineId)} canFollow={followIds.has(v.aineId)} />
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
                  <VisitItem key={v.id} v={v} showAine={aines.length > 1} employer={employerIds.has(v.aineId)} canFollow={followIds.has(v.aineId)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function VisitItem({ v, showAine, employer, canFollow }: { v: VisitRow; showAine: boolean; employer: boolean; canFollow: boolean }) {
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
        {/* L1-B (R7) : la famille employeur tranche une visite « À vérifier » ; les autres membres sont informés. */}
        {v.status === "A_VERIFIER" && !v.proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid) ? (
          employer ? (
            <VisitReviewForm visitId={v.id} firstName={v.aine.firstName} caregiver={v.caregiver.user.firstName} />
          ) : (
            <p className="rounded-md bg-soleil-soft p-3.5 text-[15px] leading-[1.45]">
              <strong>À vérifier :</strong> il manque une preuve. Le gestionnaire principal du profil confirme la visite.
            </p>
          )
        ) : null}
        {/* L1-B (L6, R4) : suivi du trajet, pour l'employeur et la personne désignée, le jour de la visite. */}
        {canFollow && (v.status === "PREVUE" || v.status === "EN_COURS") && isSoon(v.scheduledStart) ? (
          <LinkButton href={`/famille/visites/${v.id}/trajet`} variant="quiet" size="lg" fullWidth icon={<Navigation strokeWidth={1.6} />}>
            Où en est la visite ?
          </LinkButton>
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

/** Visite du jour : de 3 h avant le début à… la visite elle-même (le lien n'est utile que ce jour-là). */
function isSoon(start: Date, now: Date = new Date()): boolean {
  const diff = start.getTime() - now.getTime();
  return diff < 3 * 3_600_000 && diff > -6 * 3_600_000;
}

/** Schéma de la preuve « 2 sur 3 ». */
function ProofExplainer({ children }: { children?: React.ReactNode }) {
  const items = [
    { icon: MapPin, title: "Position à l'arrivée", text: "L'accompagnant donne sa position une seule fois, à l'arrivée." },
    { icon: KeyRound, title: "Carte domicile", text: "Il scanne le QR code de la carte domicile, ou saisit son code de secours." },
    isLaunchMode()
      ? { icon: PhoneCall, title: "Confirmation", text: "Si une preuve manque, la famille employeur confirme la visite, ou signale un problème." }
      : { icon: PhoneCall, title: "Confirmation de l'aîné", text: "Koudmen appelle l'aîné. Il tape 1 pour confirmer la visite (simulé dans la démo)." },
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
        <strong>2 preuves sur 3 = visite validée.</strong> Sinon, la visite passe « À vérifier » : le gestionnaire principal du profil confirme la visite, ou signale un problème.
      </p>
      {children ? <div className="pb-4">{children}</div> : null}
    </details>
  );
}
