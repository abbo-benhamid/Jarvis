import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getPendingProposals } from "@/server/accompagnant/queries";
import { statusIsPaid } from "@/server/rules/status-levels";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { LevelBadge } from "@/components/status-badges";
import { ProposalActions } from "@/components/accompagnant/proposal-actions";
import { communeLabel } from "@/lib/communes";
import { DAY_LABELS, FREQUENCY_LABELS, SLOT_LABELS } from "@/lib/labels";
import { formatDate, formatEuros } from "@/lib/format";
import { formatDuration } from "@/components/accompagnant/format";
import { formatEurosRounded, netIncomeEstimate, VISITS_PER_MONTH } from "@/lib/estimates";
import type { CaregiverStatus } from "@prisma/client";

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
      <header className="mb-[18px]">
        <h1 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em]">Propositions</h1>
        <p className="mt-1 text-[15px] leading-[1.45] text-muted">
          Une famille a vu votre profil et vous a choisi(e). Vous êtes libre d&apos;accepter ou de refuser.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {refus === "ok" ? (
          <Alert tone="succes" title="Refus enregistré">
            Votre refus n&apos;a aucun effet sur votre profil ni sur vos prochaines propositions.
          </Alert>
        ) : null}

        <div className="flex items-start gap-3 rounded-md bg-mer-soft px-4 py-3.5">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
          <p className="text-[15px] leading-[1.45]">
            <strong className="font-semibold">Vous décidez.</strong> Refuser une proposition est toujours possible. Pas de motif obligatoire.
            Pas de pénalité, pas de note, pas de baisse de visibilité.
          </p>
        </div>

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
            titleAs="h2"
            title="Aucune proposition en attente"
            action={
              <LinkButton href="/accompagnant/profil" variant="quiet" size="lg" fullWidth>
                Vérifier mes disponibilités
              </LinkButton>
            }
          >
            <p>Koudmen montre votre profil aux familles compatibles. Quand une famille vous choisit, la proposition apparaît ici. Vous recevez aussi un message.</p>
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {proposals.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-col gap-4" aria-labelledby={`prop-${p.id}`}>
                  <div className="flex items-center gap-3.5">
                    <Avatar name={p.request.aine.firstName} size={48} role="aine" />
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <h2 id={`prop-${p.id}`} className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
                        {p.request.aine.firstName} · {communeLabel(p.request.aine.commune)}
                      </h2>
                      <LevelBadge level={p.request.level} />
                    </div>
                  </div>
                  <dl className="m-0 flex flex-col border-t border-line text-[15px]">
                    <Row label="Fréquence">{FREQUENCY_LABELS[p.request.frequency]}</Row>
                    <Row label="Créneaux">
                      {p.request.slots.length > 0
                        ? p.request.slots.map((s) => `${DAY_LABELS[s.dayOfWeek]} ${SLOT_LABELS[s.slot].toLowerCase()}`).join(", ")
                        : "À convenir"}
                    </Row>
                    <Row label="Durée">{formatDuration(p.request.durationMinutes)} par visite</Row>
                    {p.request.startDate ? <Row label="Début">{formatDate(p.request.startDate)}</Row> : null}
                    {paid ? (
                      <Row label="Votre tarif">
                        {profile.hourlyRateCents != null ? `${formatEuros(profile.hourlyRateCents)} / heure` : "Non fixé"}
                        <span className="block text-sm font-normal text-muted">Fixé par vous</span>
                      </Row>
                    ) : null}
                  </dl>
                  {paid ? (
                    <NetIncome
                      status={profile.status}
                      rateCents={profile.hourlyRateCents}
                      durationMinutes={p.request.durationMinutes}
                      visitsPerMonth={VISITS_PER_MONTH[p.request.frequency]}
                      oneOff={p.request.frequency === "PONCTUELLE"}
                    />
                  ) : null}
                  {p.request.notes ? (
                    <div>
                      <p className="text-sm font-semibold text-muted">Mot de la famille</p>
                      <p className="mt-1 font-display text-[17px] leading-[1.45] italic">« {p.request.notes} »</p>
                    </div>
                  ) : null}
                  {p.message ? (
                    <div>
                      <p className="text-sm font-semibold text-muted">Mot de l&apos;équipe Koudmen</p>
                      <p className="mt-1 text-[15px]">{p.message}</p>
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

/** Ligne de détail : libellé `muted` à gauche, valeur à droite (passe dessous si l'écran est étroit). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-line py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 ml-auto text-right font-semibold">{children}</dd>
    </div>
  );
}

/** A4 : revenu net estimé de la mission (indicatif, avant impôt). */
function NetIncome({
  status,
  rateCents,
  durationMinutes,
  visitsPerMonth,
  oneOff,
}: {
  status: CaregiverStatus | null;
  rateCents: number | null;
  durationMinutes: number;
  visitsPerMonth: number;
  oneOff: boolean;
}) {
  const net = netIncomeEstimate(status, rateCents, durationMinutes, visitsPerMonth);
  if (!net) return null;
  return (
    <div className="rounded-md bg-feuille-soft px-4 py-3.5">
      <p className="text-sm font-semibold text-feuille">Revenu net estimé</p>
      <p className="num mt-0.5 text-[17px] font-semibold">
        environ {formatEurosRounded(net.perVisitCents)} par visite
        {oneOff ? null : <span className="font-normal"> · environ {formatEurosRounded(net.perMonthCents)} par mois</span>}
      </p>
      <p className="mt-1 text-sm text-muted">Estimation indicative, avant impôt sur le revenu.</p>
    </div>
  );
}
