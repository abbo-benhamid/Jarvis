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
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
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
            <LinkButton href="/famille/demandes/nouvelle" size="lg" fullWidth icon={<Plus strokeWidth={1.6} />}>
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
            title="Ajoutez d'abord un aîné."
            action={
              <LinkButton href="/famille/aines/nouveau" size="lg" fullWidth icon={<Plus strokeWidth={1.6} />}>
                Ajouter un aîné
              </LinkButton>
            }
          >
            Une demande concerne toujours un aîné de votre cercle Lakou.
          </EmptyState>
        ) : active.length === 0 ? (
          <EmptyState
            title="Aucune demande en cours."
            action={
              <LinkButton href="/famille/demandes/nouvelle" size="lg" fullWidth>
                Demander un accompagnement
              </LinkButton>
            }
          >
            Décrivez le besoin : niveau, fréquence, créneaux. Cela prend 2 minutes.
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {active.map((r) => (
              <RequestItem key={r.id} r={r} />
            ))}
          </ul>
        )}

        {cancelled.length > 0 ? (
          <details className="rounded-card bg-surface px-5 shadow-card">
            <summary className="flex min-h-14 cursor-pointer items-center py-3 text-[17px] font-semibold">Demandes annulées ({cancelled.length})</summary>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 pb-4">
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
    <li>
      <Card as="article" aria-labelledby={`demande-${r.id}`} className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3.5">
          <Avatar name={r.aine.firstName} size={44} role="aine" />
          <div className="min-w-0 flex-1">
            <h2 id={`demande-${r.id}`} className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
              {r.aine.firstName} {initialWithDot(r.aine.lastInitial)}
              <span className="block text-[15px] font-normal text-muted">
                Demande de {r.createdBy.firstName}, le {formatDate(r.createdAt)}
              </span>
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <RequestStatusBadge status={r.status} />
              <LevelBadge level={r.level} />
            </div>
          </div>
        </div>
        <p className="text-[17px] leading-[1.5]">{followUp(r)}</p>
        <dl className="num m-0 border-t border-line pt-1 text-[15px]">
          <Row label="Fréquence">{FREQUENCY_LABELS[r.frequency]}</Row>
          <Row label="Durée">{durationLabel(r.durationMinutes)}</Row>
          <Row label="Créneaux">{slotsText(r.slots)}</Row>
          {r.startDate ? <Row label="À partir du">{formatDate(r.startDate)}</Row> : null}
          <Row label="Envoyée le">
            {formatDate(r.createdAt)} par {r.createdBy.firstName}
          </Row>
          <Row label="Employeur">
            {EMPLOYER_TYPE_LABELS[r.employerType]}
            {r.employerName ? ` — ${r.employerName}` : ""}
          </Row>
        </dl>
        {r.notes ? <p className="rounded-md bg-surface-2 p-3.5 text-[15px] leading-[1.45]">{r.notes}</p> : null}
        {r.status === "PROPOSEE" && r.proposals.length > 0 ? <ProfileList r={r} /> : null}
        {canCancelRequest(r.status) ? <CancelRequestForm requestId={r.id} aineFirstName={r.aine.firstName} /> : null}
      </Card>
    </li>
  );
}

/** Ligne « libellé : valeur » (filet entre les lignes). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 border-b border-line py-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/**
 * D6 : profils proposés par Koudmen. Critères objectifs seulement (commune, niveau, créneaux).
 * Aucune note, aucun classement. La famille choisit ; la personne choisie accepte ou refuse.
 */
function ProfileList({ r }: { r: RequestRow }) {
  const chosen = r.proposals.some((p) => p.status === "EN_ATTENTE");
  return (
    <section aria-label={`Profils proposés pour ${r.aine.firstName}`} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="font-display text-[22px] leading-[1.2] font-normal tracking-[-.015em]">
        {chosen ? "Profil choisi" : "Profils proposés : choisissez la personne"}
      </h3>
      <p className="text-[15px] leading-[1.45] text-muted">
        Koudmen montre des profils compatibles (commune, niveau, créneaux). Aucune note, aucun classement. Vous êtes l&apos;employeur : vous
        choisissez.
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {r.proposals.map((p) => {
          const c = p.caregiver;
          const name = caregiverDisplayName(c);
          const slots = r.slots.length > 0 ? commonSlots(r.slots, c.availabilities) : [];
          return (
            <li key={p.id}>
              <article aria-label={name} className="flex flex-col gap-2.5 rounded-lg bg-surface-2/60 p-4 ring-1 ring-line">
                <div className="flex items-center gap-3">
                  <Avatar name={c.user.firstName} size={44} role="accompagnant" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-sans text-[17px] leading-snug font-semibold tracking-normal">{name}</h4>
                    {c.status ? <p className="text-[15px] text-muted">{CAREGIVER_STATUS_LABELS[c.status]}</p> : null}
                  </div>
                </div>
                {p.status === "EN_ATTENTE" ? (
                  <div>
                    <Badge tone="soleil">Choisi · en attente de réponse</Badge>
                  </div>
                ) : null}
                {c.bio ? <p className="text-[15px] leading-[1.45]">{c.bio}</p> : null}
                <p className="text-[15px] leading-[1.45] text-muted">
                  {c.communes.map(communeLabel).join(", ")} ·{" "}
                  {c.hourlyRateCents != null ? `${formatEuros(c.hourlyRateCents)} / heure (tarif fixé par l'accompagnant)` : "bénévole"}
                </p>
                {slots.length > 0 ? (
                  <p className="text-[15px] leading-[1.45]">
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
