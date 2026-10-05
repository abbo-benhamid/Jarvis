import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getFamilyAines, getFamilyRequests } from "@/server/famille/queries";
import { canCancelRequest, durationLabel } from "@/server/famille/logic";
import { CAREGIVER_STATUS_LABELS, DAY_LABELS, EMPLOYER_TYPE_LABELS, FREQUENCY_LABELS, SLOT_LABELS } from "@/lib/labels";
import { caregiverDisplayName, VERIFICATIONS_TEST_LABEL } from "@/lib/caregiver-display";
import { communeLabel } from "@/lib/communes";
import { formatEuros, initialWithDot } from "@/lib/format";
import { commonSlots } from "@/server/rules/matching";
import { Badge } from "@/components/ui/badge";
import { ChooseProfileForm } from "@/components/famille/choose-profile-form";
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
  const toChoose = r.proposals.filter((p) => p.status === "PROPOSEE_FAMILLE").length;
  const chosen = r.proposals.find((p) => p.status === "EN_ATTENTE");
  switch (r.status) {
    case "OUVERTE":
      return "L'équipe Koudmen cherche des profils compatibles. Vous choisirez la personne.";
    case "PROPOSEE":
      if (chosen) return `Vous avez choisi ${caregiverDisplayName(chosen.caregiver).replace(/\.$/, "")}. Cette personne est libre d'accepter ou de refuser.`;
      return toChoose > 0
        ? `Koudmen vous propose ${toChoose} profil${toChoose > 1 ? "s" : ""}. À vous de choisir.`
        : "L'équipe Koudmen cherche d'autres profils.";
    case "POURVUE":
      return r.mission ? `${caregiverDisplayName(r.mission.caregiver)} a accepté. Les visites sont planifiées.` : "Un accompagnant a accepté.";
    case "ANNULEE":
      return "Demande annulée.";
  }
}

function slotsText(slots: RequestRow["slots"]): string {
  if (slots.length === 0) return "Aucun créneau précis";
  return slots.map((s) => `${DAY_LABELS[s.dayOfWeek]} ${SLOT_LABELS[s.slot].toLowerCase()}`).join(", ");
}

/** F5 : demandes par aîné, avec statut et annulation. */
export default async function Page({ searchParams }: { searchParams: Promise<{ envoyee?: string; annulee?: string; choisi?: string }> }) {
  const user = await requireRole("FAMILLE");
  const { envoyee, annulee, choisi } = await searchParams;
  const [requests, aines] = await Promise.all([getFamilyRequests(user.id), getFamilyAines(user.id)]);
  const active = requests.filter((r) => r.status !== "ANNULEE");
  const cancelled = requests.filter((r) => r.status === "ANNULEE");

  return (
    <>
      <PageHeader
        eyebrow="Demandes"
        title="Demandes d'accompagnement"
        description="Vous demandez. Koudmen vous propose 1 à 3 profils. Vous choisissez. La personne choisie accepte librement."
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
            L&apos;équipe Koudmen cherche des profils compatibles. Vous recevez un message quand des profils sont prêts.
          </Alert>
        ) : null}
        {choisi ? (
          <Alert tone="succes" title={`Vous avez choisi ${choisi}.`}>
            Cette personne reçoit un message (simulé). Elle est libre d&apos;accepter ou de refuser, sans pénalité.
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
          {r.aine.firstName} {initialWithDot(r.aine.lastInitial)}
          <span className="block text-base font-normal text-muted">
            Demande de {r.createdBy.firstName}, le {formatDate(r.createdAt)}
          </span>
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
      <p className="text-sm">
        <span className="font-semibold">Employeur : </span>
        {EMPLOYER_TYPE_LABELS[r.employerType]}
        {r.employerName ? ` — ${r.employerName}` : ""}
      </p>
      {r.status === "PROPOSEE" && r.proposals.length > 0 ? <ProfileList r={r} /> : null}
      {canCancelRequest(r.status) ? <CancelRequestForm requestId={r.id} aineFirstName={r.aine.firstName} /> : null}
    </li>
  );
}

/**
 * D6 : profils proposés par Koudmen. Critères objectifs seulement (commune, niveau, créneaux).
 * Aucune note, aucun classement. La famille choisit ; la personne choisie accepte ou refuse.
 */
function ProfileList({ r }: { r: RequestRow }) {
  const chosen = r.proposals.some((p) => p.status === "EN_ATTENTE");
  return (
    <section aria-label={`Profils proposés pour ${r.aine.firstName}`} className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">{chosen ? "Profil choisi" : "Profils proposés : choisissez la personne"}</h3>
      <p className="text-sm text-muted">
        Koudmen montre des profils compatibles (commune, niveau, créneaux). Aucune note, aucun classement. Vous êtes l&apos;employeur : vous
        choisissez.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {r.proposals.map((p) => {
          const c = p.caregiver;
          const name = caregiverDisplayName(c);
          const slots = r.slots.length > 0 ? commonSlots(r.slots, c.availabilities) : [];
          return (
            <li key={p.id}>
              <article aria-label={name} className="flex h-full flex-col gap-2 rounded-xl border border-line bg-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-lg font-bold">{name}</h4>
                  {p.status === "EN_ATTENTE" ? <Badge tone="soleil">Choisi · en attente de réponse</Badge> : null}
                </div>
                <p className="text-sm">{c.status ? CAREGIVER_STATUS_LABELS[c.status] : ""}</p>
                {c.bio ? <p className="text-sm">{c.bio}</p> : null}
                <p className="text-sm text-muted">
                  {c.communes.map(communeLabel).join(", ")} ·{" "}
                  {c.hourlyRateCents != null ? `${formatEuros(c.hourlyRateCents)} / heure (tarif fixé par l'accompagnant)` : "bénévole"}
                </p>
                {slots.length > 0 ? (
                  <p className="text-sm">
                    Créneaux communs : {slots.map((s) => `${DAY_LABELS[s.dayOfWeek]} ${SLOT_LABELS[s.slot].toLowerCase()}`).join(", ")}
                  </p>
                ) : null}
                <p className="text-sm text-muted">{VERIFICATIONS_TEST_LABEL}</p>
                {p.status === "PROPOSEE_FAMILLE" && !chosen ? <ChooseProfileForm proposalId={p.id} name={name} /> : null}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
