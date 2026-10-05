import type { Appetite } from "@prisma/client";
import { Annoyed, Eye, Frown, Laugh, Meh, Smile } from "lucide-react";
import { Card, Chip } from "@/components/ui/card";
import { APPETITE_LABELS, MOOD_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

/** Pictogramme d'humeur 1-5 (toujours accompagné du texte). */
export const MOOD_ICONS = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh } as const;

export type KayeViewData = {
  mood: number;
  activities: string[];
  appetite: Appetite;
  note: string | null;
  alertFlag: boolean;
  alertNote: string | null;
  createdAt: Date;
};

/** Kayé en lecture seule (côté accompagnant) : l'humeur d'abord, la note en Fraunces, le point à surveiller à part. */
export function KayeView({ entry }: { entry: KayeViewData }) {
  const Icon = MOOD_ICONS[entry.mood as keyof typeof MOOD_ICONS] ?? Meh;
  return (
    <Card as="article" aria-label="Kayé envoyé" className="flex flex-col gap-4">
      <p className="text-sm text-muted">Envoyé le {formatDateTime(entry.createdAt)}</p>
      <div className="flex items-center gap-3.5">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-mer-soft text-mer">
          <Icon className="size-7" strokeWidth={1.6} />
        </span>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[15px]">
          <dt className="text-muted">Humeur</dt>
          <dd className="font-semibold">{MOOD_LABELS[entry.mood]}</dd>
          <dt className="text-muted">Appétit</dt>
          <dd className="font-semibold">{APPETITE_LABELS[entry.appetite]}</dd>
        </dl>
      </div>
      {entry.activities.length > 0 ? (
        <ul aria-label="Activités" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {entry.activities.map((a) => (
            <li key={a}>
              <Chip>{a}</Chip>
            </li>
          ))}
        </ul>
      ) : null}
      {entry.note ? <p className="font-display text-lg leading-[1.4] whitespace-pre-line italic">« {entry.note} »</p> : null}
      {entry.alertFlag ? (
        <div className="flex items-start gap-2.5 rounded-md bg-soleil-soft px-3.5 py-3">
          <Eye aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-soleil-ink" strokeWidth={1.6} />
          <p>
            <span className="font-semibold">À surveiller :</span> {entry.alertNote}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
