import { CircleAlert, CircleCheck, Eye, Utensils } from "lucide-react";
import type { Appetite, ProofFactor, VisitStatus } from "@prisma/client";
import { APPETITE_LABELS } from "@/lib/labels";
import { formatTime } from "@/lib/format";
import { moodSentence } from "@/server/famille/logic";
import { MoodIcon, MoodScale } from "./mood";

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

const RECEIPT_FACTOR: Record<ProofFactor, string> = {
  GPS: "Position vérifiée",
  CODE_DOMICILE: "Code du domicile correct",
  CONFIRMATION_AINE: "Appel de l'aîné confirmé",
};

/**
 * Une page du Kayé (journal de visite). Cœur émotionnel : lisible, chaleureux.
 * Le signal « à surveiller » est visible mais calme (soleil, jamais rouge) et non médical.
 */
export function KayeCard({ entry, showAine = true }: { entry: KayeEntry; showAine?: boolean }) {
  const titleId = `kaye-${entry.id}`;
  return (
    <article aria-labelledby={titleId} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {entry.alertFlag ? <SignalBanner entry={entry} /> : null}
      <div className="flex flex-col gap-4 p-5">
        <VisitReceipt entry={entry} />
        <header className="flex items-start gap-3">
          <MoodIcon mood={entry.mood} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <h3 id={titleId} className="text-xl font-bold">
              {moodSentence(entry.aine.firstName, entry.mood)}
            </h3>
            <p className="text-sm text-muted">
              {showAine ? <>Visite chez {entry.aine.firstName} · </> : null}
              {entry.author.firstName}, à {formatTime(entry.visit.scheduledStart)}
            </p>
            <MoodScale mood={entry.mood} />
          </div>
        </header>

        {entry.note ? (
          <figure className="rounded-xl bg-bg px-4 py-3">
            <blockquote className="text-lg leading-relaxed">
              <p>« {entry.note} »</p>
            </blockquote>
            <figcaption className="mt-1 text-sm text-muted">— {entry.author.firstName}</figcaption>
          </figure>
        ) : null}

        <dl className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8">
          {entry.activities.length > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-semibold text-muted">Activités</dt>
              <dd>
                <ul className="flex flex-wrap gap-2">
                  {entry.activities.map((a) => (
                    <li key={a} className="rounded-full bg-mer-soft px-3 py-1 text-sm font-semibold text-mer">
                      {a}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold text-muted">Appétit</dt>
            <dd className="inline-flex items-center gap-2">
              <Utensils aria-hidden="true" className="size-4 text-muted" />
              {APPETITE_LABELS[entry.appetite]}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/**
 * Reçu de visite (S1b-ux M6) : la preuve en tête du Kayé, comme sur la page d'accueil.
 * Icône ET texte : jamais la couleur seule.
 */
function VisitReceipt({ entry }: { entry: KayeEntry }) {
  const { status, checkInAt, proofs } = entry.visit;
  if (!status || !proofs) return null;
  const valid = proofs.filter((p) => p.valid);
  const verified = status === "VALIDEE";
  const arrival = checkInAt ? <> Arrivée de {entry.author.firstName} à {formatTime(checkInAt)}.</> : null;
  return (
    <p className={`flex items-start gap-2 rounded-lg p-3 text-sm ${verified ? "bg-feuille-soft" : "bg-soleil-soft"}`}>
      {verified ? (
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-feuille" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        <strong>{verified ? "Visite vérifiée." : "Visite à vérifier."}</strong>
        {arrival}{" "}
        {valid.length > 0 ? `${valid.map((p) => RECEIPT_FACTOR[p.factor]).join(". ")}.` : "Aucune preuve pour le moment."}{" "}
        <span className="text-muted">({valid.length} preuves sur 3, il en faut 2.)</span>
      </span>
    </p>
  );
}

function SignalBanner({ entry }: { entry: KayeEntry }) {
  return (
    <div className="flex gap-3 border-b border-soleil bg-soleil-soft px-5 py-4">
      <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-soleil text-on-soleil">
        <Eye className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-bold">À surveiller</p>
        {entry.alertNote ? <p>{entry.alertNote}</p> : <p>{entry.author.firstName} a remarqué un changement.</p>}
        <p className="text-sm text-muted">
          C&apos;est une observation de {entry.author.firstName}, pas une alerte médicale. Prenez des nouvelles de {entry.aine.firstName}. En cas
          d&apos;urgence, appelez le 15.
        </p>
      </div>
    </div>
  );
}
