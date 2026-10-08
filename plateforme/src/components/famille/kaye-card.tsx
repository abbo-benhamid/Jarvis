import { Cloud, CloudSun, Eye, Sun, Utensils } from "lucide-react";
import type { Appetite, ProofFactor, VisitStatus } from "@prisma/client";
import { APPETITE_LABELS, MOOD_LABELS, PROOF_FACTOR_LABELS, PROOF_STATE_LABELS, proofCountLabel } from "@/lib/labels";
import { deName, formatTime } from "@/lib/format";
import { factorViews, moodSentence, type FactorView } from "@/server/famille/logic";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/card";
import { KayeCard, KayeDetail } from "@/components/ui/kaye-card";
import { VisitReceipt, type ReceiptProof } from "@/components/ui/visit-receipt";
import { relativeDay } from "./format";
import { kayeProof } from "./status";

export type KayeEntry = {
  id: string;
  mood: number;
  activities: string[];
  appetite: Appetite;
  note: string | null;
  alertFlag: boolean;
  alertNote: string | null;
  createdAt: Date;
  aine: { id: string; firstName: string };
  author: { firstName: string };
  visit: {
    scheduledStart: Date;
    status?: VisitStatus;
    checkInAt?: Date | null;
    proofs?: { factor: ProofFactor; valid: boolean }[];
  };
};

function clampMood(mood: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, Math.round(mood))) as 1 | 2 | 3 | 4 | 5;
}

/** Badge « À surveiller » : soleil (jamais rouge), mot + icône. */
function SignalBadge() {
  return (
    <Badge tone="soleil" icon={<Eye strokeWidth={1.8} />}>
      À surveiller
    </Badge>
  );
}

/**
 * Aperçu d'une page du Kayé (fil, accueil) : la carte Kayé du design system.
 * La phrase d'humeur est la citation ; la note de l'accompagnant suit en `muted`.
 * Toute la carte mène au détail (reçu de visite).
 */
export function KayePreview({
  entry,
  showAine = false,
  headingLevel = 3,
  now,
}: {
  entry: KayeEntry;
  showAine?: boolean;
  headingLevel?: 2 | 3 | 4;
  now?: Date;
}) {
  return (
    <KayeCard
      href={`/famille/kaye/${entry.id}`}
      headingLevel={headingLevel}
      author={entry.author.firstName}
      day={
        <>
          {relativeDay(entry.visit.scheduledStart, now)}
          {showAine ? <> · chez {entry.aine.firstName}</> : null}
        </>
      }
      proof={kayeProof(entry.visit.status)}
      quote={moodSentence(entry.aine.firstName, clampMood(entry.mood))}
      translation={
        entry.note || entry.alertFlag ? (
          <>
            {entry.note ? <span className="block">{entry.note}</span> : null}
            {entry.alertFlag ? (
              <span className="mt-2 block">
                <SignalBadge />
              </span>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

/** X4 : un seul vocabulaire des preuves (lib/labels), web et app. */
const PROOF_LABELS: Record<ProofFactor, string> = PROOF_FACTOR_LABELS;

function proofDetail(v: FactorView, aineFirstName: string): string {
  // Le reçu suit un Kayé : la visite est faite. Une preuve absente n'a pas été obtenue.
  if (v.state === "ABSENT") return PROOF_STATE_LABELS.NON_OBTENUE;
  switch (v.factor) {
    case "GPS":
      return v.state === "VALIDE" ? "Vérifiée à l'arrivée" : "Position non vérifiée";
    case "CODE_DOMICILE":
      return v.state === "VALIDE" ? "Code correct, saisi sur place" : "Code incorrect";
    case "CONFIRMATION_AINE":
      return v.state === "VALIDE" ? `${aineFirstName} a confirmé la visite` : `${aineFirstName} n'a pas confirmé`;
  }
}

/** Preuves du reçu (2 sur 3 suffisent), dans l'ordre fixe des 3 facteurs. */
export function receiptProofs(proofs: { factor: ProofFactor; valid: boolean }[], aineFirstName: string): ReceiptProof[] {
  return factorViews(proofs).map((v) => ({
    label: PROOF_LABELS[v.factor],
    detail: proofDetail(v, aineFirstName),
    obtained: v.state === "VALIDE",
  }));
}

function verdict(status: VisitStatus | undefined, obtained: number, aineFirstName: string): { title?: string; text: string } {
  const n = proofCountLabel(obtained);
  if (status === "VALIDEE") {
    return obtained >= 2
      ? { text: "Deux preuves suffisent. La visite est validée." }
      : { title: `${n} · validée par Koudmen`, text: "L'équipe Koudmen a vérifié la visite." };
  }
  if (status === "A_VERIFIER") {
    return {
      title: `${n} · à vérifier`,
      text: `Il manque une preuve. Koudmen appelle ${aineFirstName} pour confirmer, puis l'équipe vérifie. Vous n'avez rien à faire.`,
    };
  }
  // L1d (D4, F1) : carte du domicile + position, sans la confirmation de l'aîné.
  if (status === "PRESENCE_PROBABLE") {
    return {
      title: `${n} · présence probable`,
      text: `Carte du domicile et position reçues. ${aineFirstName} n'a pas encore confirmé. Un problème ? Signalez-le dans « Visites » pendant 48 heures.`,
    };
  }
  return { title: `${n} · visite en cours`, text: "Les preuves arrivent pendant la visite." };
}

/** Icône d'humeur du badge photo (décorative : le mot porte le sens). */
function moodIcon(mood: number) {
  if (mood >= 4) return <Sun strokeWidth={1.8} />;
  if (mood === 3) return <CloudSun strokeWidth={1.8} />;
  return <Cloud strokeWidth={1.8} />;
}

/**
 * Détail d'une page du Kayé (maquette, écran c) : l'émotion d'abord, la preuve ensuite.
 * Le signal « à surveiller » reste calme (soleil) et précise qu'il n'est pas médical.
 */
export function KayeEntryDetail({ entry }: { entry: KayeEntry }) {
  const m = clampMood(entry.mood);
  const { status, checkInAt, proofs } = entry.visit;
  const rows = proofs ? receiptProofs(proofs, entry.aine.firstName) : null;
  const obtained = rows ? rows.filter((r) => r.obtained).length : 0;
  const v = verdict(status, obtained, entry.aine.firstName);
  return (
    <KayeDetail
      mood={`Humeur : ${(MOOD_LABELS[m] ?? "").toLowerCase()} (${m} sur 5)`}
      moodIcon={moodIcon(m)}
      title={moodSentence(entry.aine.firstName, m)}
      author={entry.author.firstName}
      time={`visite de ${formatTime(entry.visit.scheduledStart)}`}
    >
      {entry.alertFlag ? (
        <section aria-label="À surveiller" className="mb-4 flex flex-col gap-1.5 rounded-lg bg-soleil-soft p-4 text-fg">
          <SignalBadge />
          <p className="text-[17px] leading-[1.5]">{entry.alertNote ?? `${entry.author.firstName} a remarqué un changement.`}</p>
          <p className="text-sm leading-snug text-muted">
            C&apos;est une observation {deName(entry.author.firstName)}, pas une alerte médicale. Prenez des nouvelles {deName(entry.aine.firstName)}.
            En cas d&apos;urgence, appelez le 15.
          </p>
        </section>
      ) : null}

      {entry.note ? <p className="text-[17px] leading-[1.55]">{entry.note}</p> : null}

      <dl className="mt-4 flex flex-col gap-3">
        {entry.activities.length > 0 ? (
          <div>
            <dt className="mb-1.5 text-[15px] font-semibold text-muted">Activités</dt>
            <dd className="m-0">
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {entry.activities.map((a) => (
                  <li key={a}>
                    <Chip>{a}</Chip>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-[15px]">
          <dt className="inline-flex items-center gap-2 font-semibold text-muted">
            <Utensils aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
            Appétit :
          </dt>
          <dd className="m-0">{APPETITE_LABELS[entry.appetite]}</dd>
        </div>
      </dl>

      {rows && status ? (
        <VisitReceipt
          className="mt-6"
          code={`KDM-${entry.id.slice(-6).toUpperCase()}`}
          times={[
            { label: "Prévue", value: formatTime(entry.visit.scheduledStart) },
            { label: "Arrivée", value: checkInAt ? formatTime(checkInAt) : "—" },
            { label: "Preuves", value: `${obtained}/3` },
          ]}
          proofs={rows}
          verdictTitle={v.title}
          verdictText={v.text}
        />
      ) : null}
    </KayeDetail>
  );
}
