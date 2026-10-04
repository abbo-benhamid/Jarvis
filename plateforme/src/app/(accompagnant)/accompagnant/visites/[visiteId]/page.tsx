import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getOwnedVisit } from "@/server/accompagnant/queries";
import { isTestMode } from "@/server/accompagnant/service";
import { checkInWindow, visitAcceptsProof } from "@/server/accompagnant/rules";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { VisitStatusBadge } from "@/components/status-badges";
import { ProofSummary } from "@/components/accompagnant/visit-display";
import { CheckInPanel } from "@/components/accompagnant/checkin-panel";
import { communeLabel } from "@/lib/communes";
import { formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Visite" };

// A7 — Check-in (GPS une fois + code domicile), check-out, score 0-3.
export default async function Page({ params }: { params: Promise<{ visiteId: string }> }) {
  const user = await requireRole("ACCOMPAGNANT");
  const { visiteId } = await params;
  // Contrôle de propriété : une visite d'un autre accompagnant → 404.
  const visit = await getOwnedVisit(user.id, visiteId);
  if (!visit) notFound();

  const testMode = isTestMode();
  const now = new Date();
  const win = checkInWindow(visit, now, testMode);
  const canAddProof = visitAcceptsProof(visit) && win === "OUVERT";
  const gpsValid = visit.proofs.some((p) => p.factor === "GPS" && p.valid);
  const codeValid = visit.proofs.some((p) => p.factor === "CODE_DOMICILE" && p.valid);

  return (
    <>
      <PageHeader
        eyebrow="Visite"
        title={`Visite chez ${visit.aine.firstName}`}
        description={`${formatDate(visit.scheduledStart)}, de ${formatTime(visit.scheduledStart)} à ${formatTime(visit.scheduledEnd)} · ${communeLabel(visit.aine.commune)}`}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Statut :</span>
            <VisitStatusBadge status={visit.status} />
          </div>
          {visit.aine.addressHint ? (
            <p>
              <span className="font-semibold">Repère :</span> {visit.aine.addressHint}
            </p>
          ) : null}
          <ProofSummary score={visit.proofScore} proofs={visit.proofs} />
        </Card>

        {win === "TROP_TOT" && !visit.checkInAt ? (
          <Alert tone="info">Le check-in s&apos;ouvre 2 heures avant le début de la visite.</Alert>
        ) : null}
        {testMode && win === "OUVERT" && now < visit.scheduledStart && !visit.checkInAt ? (
          <Alert tone="attention">Mode test : vous pouvez faire le check-in avant l&apos;heure prévue.</Alert>
        ) : null}

        <CheckInPanel
          visitId={visit.id}
          canAddProof={canAddProof}
          gpsValid={gpsValid}
          codeValid={codeValid}
          checkedIn={visit.checkInAt !== null}
          checkedOut={visit.checkOutAt !== null}
          testMode={testMode}
        />

        {visit.journal ? (
          <LinkButton href={`/accompagnant/visites/${visit.id}/kaye`} variant="secondary" size="lg">
            Lire le Kayé envoyé
          </LinkButton>
        ) : visit.checkInAt ? (
          <LinkButton href={`/accompagnant/visites/${visit.id}/kaye`} variant="soleil" size="lg">
            Écrire le Kayé (2 minutes)
          </LinkButton>
        ) : null}
      </div>
    </>
  );
}
