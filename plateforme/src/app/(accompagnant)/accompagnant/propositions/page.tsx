import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { getPendingProposals } from "@/server/accompagnant/queries";
import { statusIsPaid } from "@/server/rules/status-levels";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { LevelBadge } from "@/components/status-badges";
import { ProposalActions } from "@/components/accompagnant/proposal-actions";
import { communeLabel } from "@/lib/communes";
import { DAY_LABELS, FREQUENCY_LABELS, SLOT_LABELS } from "@/lib/labels";
import { formatDate, formatEuros } from "@/lib/format";
import { formatDuration } from "@/components/accompagnant/format";

export const metadata: Metadata = { title: "Propositions" };

// A5 — Propositions : accepter ou refuser LIBREMENT (RM-05 : refus sans pénalité).
export default async function Page({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const user = await requireRole("ACCOMPAGNANT");
  const { refus } = await searchParams;
  const { profile, proposals } = await getPendingProposals(user.id);
  const paid = profile.status ? statusIsPaid(profile.status) : true;
  const canAccept = profile.validation === "VALIDE" && (!paid || profile.hourlyRateCents != null);

  return (
    <>
      <PageHeader
        eyebrow="Propositions"
        title="Propositions de mission"
        description="Une famille a vu votre profil et vous a choisi(e). Vous êtes libre d'accepter ou de refuser."
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {refus === "ok" ? (
          <Alert tone="succes" title="Refus enregistré">
            Votre refus n&apos;a aucun effet sur votre profil ni sur vos prochaines propositions.
          </Alert>
        ) : null}

        <Alert tone="info" title="Vous décidez">
          Refuser une proposition est toujours possible. Pas de motif obligatoire. Pas de pénalité, pas de note, pas de baisse de visibilité.
        </Alert>

        {profile.validation !== "VALIDE" && proposals.length > 0 ? (
          <Alert tone="attention">Votre profil doit être validé avant d&apos;accepter une mission.</Alert>
        ) : null}
        {profile.validation === "VALIDE" && paid && profile.hourlyRateCents == null ? (
          <Alert tone="attention">
            Fixez votre tarif horaire dans votre profil avant d&apos;accepter une mission.{" "}
            <Link href="/accompagnant/profil" className="font-semibold text-mer underline">
              Aller au profil
            </Link>
          </Alert>
        ) : null}

        {proposals.length === 0 ? (
          <EmptyState
            title="Aucune proposition en attente"
            action={
              <LinkButton href="/accompagnant/profil" variant="secondary">
                Vérifier mes disponibilités
              </LinkButton>
            }
          >
            <p>Koudmen montre votre profil aux familles compatibles. Quand une famille vous choisit, la proposition apparaît ici. Vous recevez aussi un message.</p>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {proposals.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-col gap-4" aria-labelledby={`prop-${p.id}`}>
                  <div className="flex flex-col gap-2">
                    <h2 id={`prop-${p.id}`} className="text-xl font-bold">
                      {p.request.aine.firstName} · {communeLabel(p.request.aine.commune)}
                    </h2>
                    <div>
                      <LevelBadge level={p.request.level} />
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
                    <dt className="font-semibold">Fréquence</dt>
                    <dd>{FREQUENCY_LABELS[p.request.frequency]}</dd>
                    <dt className="font-semibold">Créneaux</dt>
                    <dd>
                      {p.request.slots.length > 0
                        ? p.request.slots.map((s) => `${DAY_LABELS[s.dayOfWeek]} ${SLOT_LABELS[s.slot].toLowerCase()}`).join(", ")
                        : "À convenir"}
                    </dd>
                    <dt className="font-semibold">Durée</dt>
                    <dd>{formatDuration(p.request.durationMinutes)} par visite</dd>
                    {p.request.startDate ? (
                      <>
                        <dt className="font-semibold">Début</dt>
                        <dd>{formatDate(p.request.startDate)}</dd>
                      </>
                    ) : null}
                    {paid ? (
                      <>
                        <dt className="font-semibold">Votre tarif</dt>
                        <dd>
                          {profile.hourlyRateCents != null ? `${formatEuros(profile.hourlyRateCents)} / heure` : "Non fixé"}{" "}
                          <span className="text-muted">(fixé par vous)</span>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {p.request.notes ? (
                    <div>
                      <p className="font-semibold">Mot de la famille</p>
                      <p className="text-muted">{p.request.notes}</p>
                    </div>
                  ) : null}
                  {p.message ? (
                    <div>
                      <p className="font-semibold">Mot de l&apos;équipe Koudmen</p>
                      <p className="text-muted">{p.message}</p>
                    </div>
                  ) : null}
                  <ProposalActions proposalId={p.id} plannedVisits={p.plannedVisits} canAccept={canAccept} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
