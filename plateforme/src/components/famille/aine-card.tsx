import Link from "next/link";
import { CalendarDays, ChevronRight, Eye, Users } from "lucide-react";
import type { Plan } from "@prisma/client";
import { communeLabel } from "@/lib/communes";
import { formatDate, formatTime } from "@/lib/format";
import { PLAN_LABELS } from "@/lib/labels";
import { LevelBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { MoodIcon } from "./mood";
import { Term } from "@/components/ui/term";
import { moodSentence } from "@/server/famille/logic";

export type AineCardData = {
  id: string;
  firstName: string;
  lastInitial: string | null;
  commune: string;
  activityLevel: number;
  plan: Plan | null;
  membersCount: number;
  openRequests: number;
  nextVisit: { scheduledStart: Date; caregiverFirstName: string } | null;
  lastKaye: { createdAt: Date; mood: number; alertFlag: boolean } | null;
};

/** F1 : carte d'un aîné du cercle. */
export function AineCard({ aine }: { aine: AineCardData }) {
  const titleId = `aine-${aine.id}`;
  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-2xl font-bold">
            <Link href={`/famille/aines/${aine.id}`} className="underline-offset-4 hover:underline">
              {aine.firstName} {aine.lastInitial ?? ""}
            </Link>
          </h2>
          <p className="text-muted">{communeLabel(aine.commune)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LevelBadge level={aine.activityLevel} />
          {aine.plan ? <Badge tone="neutre">Formule {PLAN_LABELS[aine.plan]}</Badge> : null}
        </div>
      </header>

      {/* dl valide (axe definition-list) : chaque div enfant contient seulement dt + dd ; l'icône est dans le dt. */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-bg p-3">
          <dt className="flex items-center gap-2 text-sm font-semibold text-muted">
            <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-mer" />
            Prochaine visite
          </dt>
          <dd className="mt-1">
            {aine.nextVisit ? (
              <>
                {formatDate(aine.nextVisit.scheduledStart)} à {formatTime(aine.nextVisit.scheduledStart)}
                <span className="block text-sm text-muted">avec {aine.nextVisit.caregiverFirstName}</span>
              </>
            ) : aine.openRequests > 0 ? (
              "Demande en cours : Koudmen cherche un accompagnant."
            ) : (
              "Aucune visite prévue."
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-bg p-3">
          <dt className="flex items-center gap-2 text-sm font-semibold text-muted">
            {aine.lastKaye ? <MoodIcon mood={aine.lastKaye.mood} size="sm" /> : <Users aria-hidden="true" className="size-5 shrink-0 text-mer" />}
            Dernier <Term id="kaye" />
          </dt>
          <dd className="mt-1">
            {aine.lastKaye ? (
              <>
                {moodSentence(aine.firstName, aine.lastKaye.mood)}
                <span className="block text-sm text-muted">{formatDate(aine.lastKaye.createdAt)}</span>
                {aine.lastKaye.alertFlag ? (
                  <Badge tone="soleil" className="mt-1">
                    <Eye aria-hidden="true" className="size-3.5" />À surveiller
                  </Badge>
                ) : null}
              </>
            ) : (
              "Pas encore de Kayé. Il arrive après la première visite."
            )}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        <li>
          <Link href={`/famille/aines/${aine.id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-mer underline-offset-4 hover:underline">
            Voir la fiche <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </li>
        <li>
          <Link href={`/famille/kaye?aine=${aine.id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-mer underline-offset-4 hover:underline">
            Lire le Kayé <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </li>
        <li>
          <Link href={`/famille/aines/${aine.id}/cercle`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-mer underline-offset-4 hover:underline">
            Cercle Lakou ({aine.membersCount} {aine.membersCount > 1 ? "membres" : "membre"}) <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </li>
      </ul>
    </article>
  );
}
