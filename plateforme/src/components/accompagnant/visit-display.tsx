import type { VisitStatus } from "@prisma/client";
import { NotebookPen } from "lucide-react";
import { Badge, ProofBadge } from "@/components/ui/badge";
import { CardLink, DateBox } from "@/components/ui/card";
import { VisitStatusBadge } from "@/components/status-badges";
import { capitalize, dayLong, dayNumber, hourLabel, weekdayShort } from "@/components/famille/format";
import { communeLabel, fuseauDe, type CodeTerritoire } from "@/lib/territoires";
import { initialWithDot } from "@/lib/format";

/** Deux preuves sur trois suffisent (RM-07). */
export const PROOFS_NEEDED = 2;

export type VisitRowData = {
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: VisitStatus;
  proofScore: number;
  checkInAt: Date | null;
  aine: { firstName: string; lastInitial: string | null; commune: string; territoire?: CodeTerritoire };
  journal: { id: string } | null;
};

/** « Léonie B. » */
export function aineShortName(aine: { firstName: string; lastInitial: string | null }): string {
  return `${aine.firstName}${aine.lastInitial ? ` ${initialWithDot(aine.lastInitial)}` : ""}`;
}

/** « 10 h – 12 h » dans le fuseau du territoire de l'aîné (T4). */
export function hourRange(start: Date, end: Date, tz?: string): string {
  return `${hourLabel(start, tz)} – ${hourLabel(end, tz)}`;
}

/** Vrai si l'arrivée est enregistrée et le Kayé pas encore écrit. */
export function kayeIsDue(v: Pick<VisitRowData, "checkInAt" | "journal">): boolean {
  return v.checkInAt !== null && v.journal === null;
}

/** Badge de preuve d'une visite : « Prouvée » dès 2 preuves, sinon « Preuves 1 sur 2 ». Le mot porte le sens. */
export function VisitProofBadge({ score }: { score: number }) {
  if (score >= PROOFS_NEEDED) return <ProofBadge status="preuve" />;
  return <ProofBadge status={score > 0 ? "a-faire" : "neutre"}>{`Preuves ${score} sur ${PROOFS_NEEDED}`}</ProofBadge>;
}

/**
 * Ligne de visite (listes) : toute la carte est le lien (§ 10).
 * Kayé à écrire : la carte mène au Kayé et le dit.
 */
export function VisitRow({ visit, showDate = true }: { visit: VisitRowData; showDate?: boolean }) {
  const due = kayeIsDue(visit);
  const href = due ? `/accompagnant/visites/${visit.id}/kaye` : `/accompagnant/visites/${visit.id}`;
  return (
    <CardLink href={href} padding="dense">
      <span className="flex items-center gap-4">
        {showDate ? (
          <DateBox day={weekdayShort(visit.scheduledStart)} date={dayNumber(visit.scheduledStart)} label={dayLong(visit.scheduledStart)} />
        ) : null}
        <span className="flex min-w-0 flex-col gap-1">
          <b className="num block font-semibold">{hourRange(visit.scheduledStart, visit.scheduledEnd, fuseauDe(visit.aine.territoire))}</b>
          <span className="block text-[15px] leading-[1.4] text-muted">
            {aineShortName(visit.aine)} · {communeLabel(visit.aine.commune)}
          </span>
          {showDate ? null : <span className="sr-only">{capitalize(dayLong(visit.scheduledStart))}</span>}
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <VisitStatusBadge status={visit.status} />
            {visit.checkInAt ? <VisitProofBadge score={visit.proofScore} /> : null}
            {due ? (
              <Badge tone="soleil" icon={<NotebookPen strokeWidth={1.8} />}>
                Kayé à écrire
              </Badge>
            ) : visit.journal ? (
              <Badge tone="neutre">Kayé envoyé</Badge>
            ) : null}
          </span>
        </span>
      </span>
    </CardLink>
  );
}
