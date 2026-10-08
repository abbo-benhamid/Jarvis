import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { getRequestWithCandidates } from "@/server/operateur/queries";
import { ageLabel } from "@/server/operateur/rules";
import { MATCH_REASON_LABELS, MAX_PROFILES_PER_REQUEST } from "@/server/rules/matching";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LevelBadge, ProposalStatusBadge, RequestStatusBadge, ValidationBadge } from "@/components/status-badges";
import { BackLink, InfoRow, SlotList } from "@/components/operateur/display";
import { ProposeForm } from "@/components/operateur/forms";
import { CAREGIVER_STATUS_LABELS, FREQUENCY_LABELS, NEED_LABELS } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";
import { formatDate, formatDateTime, formatEuros } from "@/lib/format";
import { isLaunchMode } from "@/server/launch";

export const metadata: Metadata = { title: "Matching manuel" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  await requireRole("OPERATEUR");
  const { requestId } = await params;
  if (!z.string().cuid().safeParse(requestId).success) notFound();
  const data = await getRequestWithCandidates(requestId);
  if (!data) notFound();
  const { request: r, candidates } = data;
  const active = r.proposals.filter((p) => p.status === "PROPOSEE_FAMILLE" || p.status === "EN_ATTENTE").length;
  const canPropose = (r.status === "OUVERTE" || r.status === "PROPOSEE") && active < MAX_PROFILES_PER_REQUEST;
  const compatible = candidates.filter((c) => c.match.compatible);
  const incompatible = candidates.filter((c) => !c.match.compatible);

  return (
    <>
      <BackLink href="/operateur/demandes">Toutes les demandes</BackLink>
      <PageHeader
        eyebrow="Matching manuel"
        title={`Demande pour ${r.aine.firstName} ${r.aine.lastInitial ?? ""}`}
        description={`${communeLabel(r.aine.commune)} · créée ${ageLabel(r.createdAt)} par ${r.createdBy.firstName}`}
        actions={<RequestStatusBadge status={r.status} />}
      />

      <Card aria-labelledby="t-besoin">
        <CardTitle id="t-besoin">Besoin</CardTitle>
        <dl className="divide-y divide-line">
          <InfoRow label="Niveau">
            <LevelBadge level={r.level} />
          </InfoRow>
          <InfoRow label="Fréquence">
            {FREQUENCY_LABELS[r.frequency]} · {r.durationMinutes} min
          </InfoRow>
          <InfoRow label="Créneaux">
            <SlotList slots={r.slots} />
          </InfoRow>
          {r.startDate ? <InfoRow label="Début souhaité">{formatDate(r.startDate)}</InfoRow> : null}
          <InfoRow label="Besoins de l'aîné">{r.aine.needs.map((n) => NEED_LABELS[n]).join(", ") || "—"}</InfoRow>
          {r.notes ? <InfoRow label="Notes de la famille">{r.notes}</InfoRow> : null}
        </dl>
      </Card>

      {r.proposals.length > 0 ? (
        <section aria-labelledby="t-props" className="mt-6">
          <h2 id="t-props" className="mb-1 font-display text-[24px] leading-tight font-normal tracking-[-.015em]">
            Profils proposés à la famille
          </h2>
          <p className="mb-3 text-muted">
            {active} profil(s) actif(s) sur {MAX_PROFILES_PER_REQUEST} au maximum. La famille choisit ; la personne choisie accepte ou refuse.
          </p>
          <ul className="flex flex-col gap-2">
            {r.proposals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-4 py-3 shadow-card">
                <span>
                  {p.caregiver.user.firstName} {p.caregiver.user.lastName} — {formatDateTime(p.createdAt)}
                </span>
                {/* Un refus reste libre et sans motif affiché (anti-requalification). */}
                <ProposalStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.mission ? (
        <Alert tone="succes" title="Demande pourvue" className="mt-6">
          Mission acceptée par {r.mission.caregiver.user.firstName} {r.mission.caregiver.user.lastName}.
        </Alert>
      ) : null}
      {!canPropose && !r.mission ? (
        <Alert tone="info" className="mt-6">
          {active >= MAX_PROFILES_PER_REQUEST
            ? `La famille a déjà ${MAX_PROFILES_PER_REQUEST} profils à choisir. C'est le maximum.`
            : "Cette demande n'accepte plus de proposition."}
        </Alert>
      ) : null}

      <section aria-labelledby="t-compat" className="mt-8">
        <h2 id="t-compat" className="mb-1 font-display text-[24px] leading-tight font-normal tracking-[-.015em]">
          Accompagnants compatibles ({compatible.length})
        </h2>
        <p className="mb-4 text-muted">
          Tri : nombre de créneaux communs, puis nom. Aucune note, aucun classement. Vous proposez 1 à 3 profils ; la famille choisit ;
          l&apos;accompagnant reste libre de refuser.
        </p>
        {compatible.length === 0 ? (
          <Alert tone="attention">Aucun accompagnant compatible. Lisez les raisons ci-dessous, ou contactez la famille pour ajuster les créneaux.</Alert>
        ) : (
          <ul className="flex flex-col gap-3">
            {compatible.map((c) => (
              <CandidateCard key={c.data.id} c={c} requestId={r.id} canPropose={canPropose} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-incompat" className="mt-8">
        <h2 id="t-incompat" className="mb-1 font-display text-[24px] leading-tight font-normal tracking-[-.015em]">
          Accompagnants non compatibles ({incompatible.length})
        </h2>
        <p className="mb-4 text-muted">Le serveur refuse toute proposition à ces personnes.</p>
        <ul className="flex flex-col gap-3">
          {incompatible.map((c) => (
            <CandidateCard key={c.data.id} c={c} requestId={r.id} canPropose={false} />
          ))}
        </ul>
      </section>
    </>
  );
}

type C = NonNullable<Awaited<ReturnType<typeof getRequestWithCandidates>>>["candidates"][number];

function CandidateCard({ c, requestId, canPropose }: { c: C; requestId: string; canPropose: boolean }) {
  const d = c.data;
  const titleId = `cand-${d.id}`;
  return (
    <li>
      <article aria-labelledby={titleId} className="rounded-card bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
            {c.name}
          </h3>
          <span className="flex flex-wrap gap-1">
            {c.match.compatible ? <Badge tone="feuille">Compatible</Badge> : <Badge tone="neutre">Non compatible</Badge>}
            <ValidationBadge status={d.validation} />
          </span>
        </div>
        <p>{d.status ? CAREGIVER_STATUS_LABELS[d.status] : "Statut non défini"}</p>
        <p className="text-sm text-muted">
          Niveaux {d.allowedLevels.join(", ") || "aucun"} · {d.communes.map(communeLabel).join(", ") || "aucune commune"} · tarif{" "}
          {d.hourlyRateCents != null ? formatEuros(d.hourlyRateCents) : "bénévole"} (fixé par l&apos;accompagnant)
        </p>
        <p className="text-sm">
          Créneaux communs : <SlotList slots={c.match.commonSlots} empty="aucun" />
        </p>
        {!c.match.compatible ? (
          <div className="mt-2">
            <p className="font-semibold">Raisons :</p>
            <ul className="list-disc pl-5">
              {c.match.reasons.map((reason) => (
                <li key={reason}>{MATCH_REASON_LABELS[reason]}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3">
          {d.proposalStatus === "PROPOSEE_FAMILLE" ? (
            <Alert tone="succes" title="Profil proposé à la famille">
              La famille choisit. Si elle choisit ce profil, {isLaunchMode() ? "Koudmen prévient l'accompagnant." : "l'accompagnant reçoit un message (simulé)."} Il reste libre de refuser.
            </Alert>
          ) : d.proposalStatus === "EN_ATTENTE" ? (
            <Alert tone="succes" title="Choisi par la famille">
              En attente de la réponse de l&apos;accompagnant. Il reste libre de refuser.
            </Alert>
          ) : d.proposalStatus ? (
            <p className="flex items-center gap-2">
              Proposition déjà envoyée : <ProposalStatusBadge status={d.proposalStatus} />
            </p>
          ) : canPropose && c.match.compatible ? (
            <ProposeForm requestId={requestId} caregiverId={d.id} name={c.name} />
          ) : null}
        </div>
      </article>
    </li>
  );
}
