import Link from "next/link";
import type { ProofFactor, VisitStatus } from "@prisma/client";
import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { VisitStatusBadge } from "@/components/status-badges";
import { communeLabel } from "@/lib/communes";
import { PROOF_FACTOR_LABELS } from "@/lib/labels";
import { formatDate, formatTime } from "@/lib/format";

const FACTORS: ProofFactor[] = ["GPS", "CODE_DOMICILE", "CONFIRMATION_AINE"];

/** Score de preuve 0-3 + état de chaque facteur (icône + texte, jamais la couleur seule). */
export function ProofSummary({
  score,
  proofs,
}: {
  score: number;
  proofs: { factor: ProofFactor; valid: boolean; simulated: boolean; details?: string | null }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-bold">
        Preuves : {score} sur 3 <span className="font-normal text-muted">(2 suffisent)</span>
      </p>
      <ul className="flex flex-col gap-1">
        {FACTORS.map((f) => {
          const p = proofs.find((x) => x.factor === f);
          const state = !p ? "absent" : p.valid ? "valide" : "invalide";
          return (
            <li key={f} className="flex items-start gap-2">
              {state === "valide" ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-feuille" />
              ) : state === "invalide" ? (
                <CircleX aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-hibiscus" />
              ) : (
                <CircleDashed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
              )}
              <span>
                <span className="font-semibold">{PROOF_FACTOR_LABELS[f]}</span> :{" "}
                {state === "valide" ? "valide" : state === "invalide" ? "non valide" : "pas encore"}
                {p?.simulated ? " (simulé)" : ""}
                {p?.details && state === "invalide" ? <span className="text-muted"> — {p.details}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type VisitRowData = {
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: VisitStatus;
  proofScore: number;
  checkInAt: Date | null;
  aine: { firstName: string; lastInitial: string | null; commune: string };
  journal: { id: string } | null;
};

export function VisitRow({ visit }: { visit: VisitRowData }) {
  const kayeToWrite = visit.checkInAt !== null && visit.journal === null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <Link href={`/accompagnant/visites/${visit.id}`} className="text-lg font-bold text-mer underline-offset-2 hover:underline">
          {formatDate(visit.scheduledStart)}, {formatTime(visit.scheduledStart)} – {formatTime(visit.scheduledEnd)}
        </Link>
        <p>
          {visit.aine.firstName}
          {visit.aine.lastInitial ? ` ${visit.aine.lastInitial}.` : ""} · {communeLabel(visit.aine.commune)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <VisitStatusBadge status={visit.status} />
          <span className="text-sm text-muted">Preuves : {visit.proofScore} sur 3</span>
          {visit.journal ? <span className="text-sm text-muted">· Kayé envoyé</span> : null}
        </div>
      </div>
      {kayeToWrite ? (
        <Link
          href={`/accompagnant/visites/${visit.id}/kaye`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-soleil px-4 font-semibold text-on-soleil"
        >
          Écrire le Kayé
        </Link>
      ) : (
        <Link
          href={`/accompagnant/visites/${visit.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 font-semibold"
        >
          Ouvrir
          <span className="sr-only"> la visite du {formatDate(visit.scheduledStart)}</span>
        </Link>
      )}
    </div>
  );
}
