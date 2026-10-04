import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, MapPin, PhoneCall } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { getFamilyAines, getFamilyVisits } from "@/server/famille/queries";
import { canConfirmElder, displayVisitStatus, splitVisits } from "@/server/famille/logic";
import { formatDate, formatTime } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { VisitStatusBadge } from "@/components/status-badges";
import { ProofFactors } from "@/components/famille/proof-factors";
import { ConfirmVisitForm } from "@/components/famille/confirm-visit-form";
import { FilterTabs } from "@/components/famille/filter-tabs";

export const metadata: Metadata = { title: "Visites" };

type VisitRow = Awaited<ReturnType<typeof getFamilyVisits>>[number];

/** F7 : visites à venir et passées, preuve 2 sur 3, confirmation simulée de l'aîné. */
export default async function Page({ searchParams }: { searchParams: Promise<{ aine?: string; confirmee?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aine: aineFilter, confirmee } = await searchParams;
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
        description="Chaque visite est prouvée. Il faut 2 preuves sur 3 pour la valider."
      />
      <div className="flex flex-col gap-6">
        {visits.length > 0 ? <MicroQuestion user={user} questionKey="PREUVE_COMPRISE" path="/famille/visites" /> : null}
        {confirmee === "validee" ? (
          <Alert tone="succes" title="Confirmation enregistrée. La visite est validée.">
            L&apos;appel à l&apos;aîné est simulé dans cette version de test.
          </Alert>
        ) : null}
        {confirmee === "partielle" ? (
          <Alert tone="info" title="Confirmation enregistrée.">
            Il manque encore une preuve pour valider la visite. L&apos;équipe Koudmen vérifie.
          </Alert>
        ) : null}
        <ProofExplainer />

        {aines.length > 1 ? (
          <FilterTabs
            label="Filtrer par aîné"
            tabs={[
              { href: "/famille/visites", label: "Tous", active: !selected },
              ...aines.map((a) => ({ href: `/famille/visites?aine=${a.id}`, label: a.firstName, active: selected === a.id })),
            ]}
          />
        ) : null}

        {visits.length === 0 ? (
          <EmptyState
            title="Aucune visite pour le moment"
            action={aines.length > 0 ? <LinkButton href="/famille/demandes/nouvelle">Demander un accompagnement</LinkButton> : <LinkButton href="/famille/aines/nouveau">Ajouter un aîné</LinkButton>}
          >
            Les visites apparaissent ici quand un accompagnant accepte une demande.
          </EmptyState>
        ) : (
          <>
            <section aria-labelledby="a-venir" className="flex flex-col gap-3">
              <h2 id="a-venir" className="text-2xl font-bold">
                À venir et en cours ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-muted">Aucune visite prévue.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {upcoming.map((v) => (
                    <VisitItem key={v.id} v={v} />
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="passees" className="flex flex-col gap-3">
              <h2 id="passees" className="text-2xl font-bold">
                Passées ({past.length})
              </h2>
              {past.length === 0 ? (
                <p className="text-muted">Aucune visite passée.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {past.map((v) => (
                    <VisitItem key={v.id} v={v} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function VisitItem({ v }: { v: VisitRow }) {
  const confirmable = canConfirmElder(v.status, v.proofs);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">
            {formatDate(v.scheduledStart)}, {formatTime(v.scheduledStart)} – {formatTime(v.scheduledEnd)}
          </h3>
          <p className="text-muted">
            Chez {v.aine.firstName} avec {v.caregiver.user.firstName}
          </p>
        </div>
        <VisitStatusBadge status={v.status} />
      </div>
      {v.status === "PREVUE" ? (
        <p className="text-sm text-muted">Les preuves arrivent pendant la visite.</p>
      ) : (
        <ProofFactors proofs={v.proofs} />
      )}
      {v.status === "A_VERIFIER" && !confirmable ? (
        <p className="text-sm">L&apos;équipe Koudmen vérifie cette visite.</p>
      ) : null}
      {confirmable ? <ConfirmVisitForm visitId={v.id} aineFirstName={v.aine.firstName} /> : null}
      {v.journal ? (
        <Link href={`/famille/kaye?aine=${v.aine.id}#kaye-${v.journal.id}`} className="inline-flex min-h-11 items-center font-semibold text-mer underline">
          Lire le Kayé de cette visite
        </Link>
      ) : null}
    </li>
  );
}

/** Schéma de la preuve « 2 sur 3 ». */
function ProofExplainer() {
  const items = [
    { icon: MapPin, title: "Position", text: "L'accompagnant partage sa position une seule fois, à l'arrivée." },
    { icon: KeyRound, title: "Code du domicile", text: "Il saisit le code affiché chez l'aîné." },
    { icon: PhoneCall, title: "Confirmation", text: "L'aîné confirme la visite par téléphone (simulé en test)." },
  ];
  return (
    <details className="rounded-xl border border-line bg-surface px-4 py-2">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Comment Koudmen prouve une visite ?</summary>
      <ol className="grid gap-3 pb-3 sm:grid-cols-3">
        {items.map((it) => (
          <li key={it.title} className="flex gap-3 rounded-lg bg-bg p-3">
            <it.icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" />
            <div>
              <p className="font-bold">{it.title}</p>
              <p className="text-sm text-muted">{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="pb-3 text-sm">
        <strong>2 preuves sur 3 = visite validée.</strong> Sinon, la visite passe « À vérifier » et l&apos;équipe Koudmen contrôle.
      </p>
    </details>
  );
}
