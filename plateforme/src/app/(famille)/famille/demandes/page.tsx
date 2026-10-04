import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines, getFamilyRequests } from "@/server/famille/queries";
import { canCancelRequest, durationLabel } from "@/server/famille/logic";
import { DAY_LABELS, FREQUENCY_LABELS, SLOT_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LevelBadge, RequestStatusBadge } from "@/components/status-badges";
import { CancelRequestForm } from "@/components/famille/cancel-request-form";

export const metadata: Metadata = { title: "Demandes d'accompagnement" };

type RequestRow = Awaited<ReturnType<typeof getFamilyRequests>>[number];

/** Texte de suivi, sans détail des refus d'accompagnant (anti-requalification, respect de chacun). */
function followUp(r: RequestRow): string {
  switch (r.status) {
    case "OUVERTE":
      return "L'équipe Koudmen cherche un accompagnant compatible.";
    case "PROPOSEE":
      return r._count.proposals > 0
        ? `${r._count.proposals === 1 ? "1 accompagnant étudie" : `${r._count.proposals} accompagnants étudient`} la demande. Chacun est libre d'accepter.`
        : "L'équipe Koudmen cherche un autre accompagnant.";
    case "POURVUE":
      return r.mission ? `${r.mission.caregiver.user.firstName} a accepté. Les visites sont planifiées.` : "Un accompagnant a accepté.";
    case "ANNULEE":
      return "Demande annulée.";
  }
}

function slotsText(slots: RequestRow["slots"]): string {
  if (slots.length === 0) return "Aucun créneau précis";
  return slots.map((s) => `${DAY_LABELS[s.dayOfWeek]} ${SLOT_LABELS[s.slot].toLowerCase()}`).join(", ");
}

/** F5 : demandes par aîné, avec statut et annulation. */
export default async function Page({ searchParams }: { searchParams: Promise<{ envoyee?: string; annulee?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { envoyee, annulee } = await searchParams;
  const [requests, aines] = await Promise.all([getFamilyRequests(user.id), getFamilyAines(user.id)]);
  const active = requests.filter((r) => r.status !== "ANNULEE");
  const cancelled = requests.filter((r) => r.status === "ANNULEE");

  return (
    <>
      <PageHeader
        eyebrow="Demandes"
        title="Demandes d'accompagnement"
        description="Vous demandez. L'équipe Koudmen propose un accompagnant vérifié. L'accompagnant accepte librement."
        actions={
          aines.length > 0 ? (
            <LinkButton href="/famille/demandes/nouvelle">
              <Plus aria-hidden="true" className="size-4" />
              Nouvelle demande
            </LinkButton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {envoyee ? (
          <Alert tone="succes" title="Demande envoyée.">
            L&apos;équipe Koudmen cherche un accompagnant. Vous recevez un message dès qu&apos;une personne accepte.
          </Alert>
        ) : null}
        {annulee ? <Alert tone="succes" title="Demande annulée.">Les propositions en attente sont annulées aussi.</Alert> : null}

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
        ) : active.length === 0 ? (
          <EmptyState title="Aucune demande en cours" action={<LinkButton href="/famille/demandes/nouvelle">Demander un accompagnement</LinkButton>}>
            Décrivez le besoin : niveau, fréquence, créneaux. Cela prend 2 minutes.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {active.map((r) => (
              <RequestItem key={r.id} r={r} />
            ))}
          </ul>
        )}

        {cancelled.length > 0 ? (
          <details className="rounded-xl border border-line bg-surface px-4 py-2">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">Demandes annulées ({cancelled.length})</summary>
            <ul className="flex flex-col gap-3 pb-3">
              {cancelled.map((r) => (
                <RequestItem key={r.id} r={r} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </>
  );
}

function RequestItem({ r }: { r: RequestRow }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-xl font-bold">
          {r.aine.firstName} {r.aine.lastInitial ?? ""}
        </h2>
        <RequestStatusBadge status={r.status} />
      </div>
      <p>{followUp(r)}</p>
      <div className="flex flex-wrap gap-2">
        <LevelBadge level={r.level} />
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold">Fréquence : </dt>
          <dd className="inline">{FREQUENCY_LABELS[r.frequency]}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Durée : </dt>
          <dd className="inline">{durationLabel(r.durationMinutes)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline font-semibold">Créneaux : </dt>
          <dd className="inline">{slotsText(r.slots)}</dd>
        </div>
        {r.startDate ? (
          <div>
            <dt className="inline font-semibold">À partir du : </dt>
            <dd className="inline">{formatDate(r.startDate)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-semibold">Envoyée le : </dt>
          <dd className="inline">
            {formatDate(r.createdAt)} par {r.createdBy.firstName}
          </dd>
        </div>
      </dl>
      {r.notes ? <p className="rounded-lg bg-bg p-3 text-sm">{r.notes}</p> : null}
      {canCancelRequest(r.status) ? <CancelRequestForm requestId={r.id} aineFirstName={r.aine.firstName} /> : null}
    </li>
  );
}
