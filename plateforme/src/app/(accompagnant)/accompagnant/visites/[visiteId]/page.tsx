import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound, MapPin } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getOwnedVisit } from "@/server/accompagnant/queries";
import { isTestMode } from "@/server/accompagnant/service";
import { checkInWindow, visitAcceptsProof } from "@/server/accompagnant/rules";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { VisitStatusBadge } from "@/components/status-badges";
import { TopBar } from "@/components/famille/top-bar";
import { capitalize, dayLong, hourLabel, relativeDay } from "@/components/famille/format";
import { CheckInPanel } from "@/components/accompagnant/checkin-panel";
import { VisitMap } from "@/components/accompagnant/visit-map";
import { aineShortName, hourRange } from "@/components/accompagnant/visit-display";
import { communeLabel } from "@/lib/communes";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Visite" };

// A7 (maquette, écran d) — Check-in (GPS une fois + code domicile), check-out, score 0-3.
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
  const aineConfirmed = visit.proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid);
  // S1b-ux M12 (lecture en plus, affichage seulement) : dans un monde de test, le code affiché chez l'aîné
  // reste visible sur la page de la visite. Jamais dans le monde réel : le code se lit seulement sur place.
  const testHomeCode = user.sandboxId
    ? (await db.visit.findFirst({ where: { id: visit.id, aine: { sandboxId: user.sandboxId } }, select: { aine: { select: { homeCode: true } } } }))
        ?.aine.homeCode
    : null;
  const day = relativeDay(visit.scheduledStart, now) === "aujourd'hui" ? "Aujourd'hui" : capitalize(dayLong(visit.scheduledStart));

  return (
    <>
      <TopBar title={`Chez ${visit.aine.firstName}`} backHref="/accompagnant/visites" backLabel="Retour à mes visites" />

      <div className="flex flex-col gap-4">
        <section aria-label={`Visite chez ${visit.aine.firstName}`} className="rounded-card bg-surface p-4 shadow-card">
          <VisitMap />
          <div className="mt-3.5 flex items-center gap-3.5">
            <Avatar name={visit.aine.firstName} size={48} role="aine" />
            <div className="min-w-0">
              <p className="text-[17px] leading-snug font-semibold">{aineShortName(visit.aine)}</p>
              <p className="flex items-center gap-1 text-[15px] text-muted">
                <MapPin aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.6} />
                {communeLabel(visit.aine.commune)}
              </p>
            </div>
          </div>
          {visit.aine.addressHint ? (
            <p className="mt-3 rounded-md bg-surface-2 px-3.5 py-2.5 text-[15px]">
              <span className="font-semibold">Repère :</span> {visit.aine.addressHint}
            </p>
          ) : null}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
            <p className="num text-[15px] text-muted">
              {day} · {hourRange(visit.scheduledStart, visit.scheduledEnd)}
            </p>
            <VisitStatusBadge status={visit.status} />
          </div>
        </section>

        {testHomeCode ? (
          <div className="flex flex-col gap-1 rounded-md border-2 border-dashed border-mer bg-mer-soft p-4">
            <p className="flex items-center gap-2 font-semibold">
              <KeyRound aria-hidden="true" className="size-5 text-mer" strokeWidth={1.6} />
              Code affiché chez {visit.aine.firstName} (test)
            </p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">
              <span className="sr-only">Lettre par lettre : {testHomeCode.split("").join(" ")}</span>
              <span aria-hidden="true">{testHomeCode}</span>
            </p>
            <p className="text-sm">En vrai, vous lisez ce code sur la feuille près de la porte. Saisissez-le à l&apos;étape « Code du domicile ».</p>
          </div>
        ) : null}

        {win === "TROP_TOT" && !visit.checkInAt ? (
          <Alert tone="info">Vous pouvez enregistrer votre arrivée 2 heures avant le début de la visite.</Alert>
        ) : null}
        {testMode && win === "OUVERT" && now < visit.scheduledStart && !visit.checkInAt ? (
          <Alert tone="attention">Mode test : vous pouvez enregistrer votre arrivée avant l&apos;heure prévue.</Alert>
        ) : null}
      </div>

      <CheckInPanel
        visitId={visit.id}
        aineFirstName={visit.aine.firstName}
        canAddProof={canAddProof}
        gpsValid={gpsValid}
        codeValid={codeValid}
        aineConfirmed={aineConfirmed}
        score={visit.proofScore}
        checkedIn={visit.checkInAt !== null}
        checkInLabel={visit.checkInAt ? hourLabel(visit.checkInAt) : null}
        checkedOut={visit.checkOutAt !== null}
        hasJournal={visit.journal !== null}
        testMode={testMode}
      />
    </>
  );
}
