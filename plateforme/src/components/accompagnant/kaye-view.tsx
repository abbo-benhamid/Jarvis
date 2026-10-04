import type { Appetite } from "@prisma/client";
import { Annoyed, Frown, Laugh, Meh, Smile, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
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

/** Kayé en lecture seule. */
export function KayeView({ entry }: { entry: KayeViewData }) {
  const Icon = MOOD_ICONS[entry.mood as keyof typeof MOOD_ICONS] ?? Meh;
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-muted">Envoyé le {formatDateTime(entry.createdAt)}</p>
      <p className="flex items-center gap-2 text-lg">
        <Icon aria-hidden="true" className="size-8 text-mer" />
        <span>
          <span className="font-semibold">Humeur :</span> {MOOD_LABELS[entry.mood]}
        </span>
      </p>
      <p>
        <span className="font-semibold">Appétit :</span> {APPETITE_LABELS[entry.appetite]}
      </p>
      {entry.activities.length > 0 ? (
        <p>
          <span className="font-semibold">Activités :</span> {entry.activities.join(", ")}
        </p>
      ) : null}
      {entry.note ? <p className="whitespace-pre-line">{entry.note}</p> : null}
      {entry.alertFlag ? (
        <div className="flex items-start gap-2 rounded-lg border-l-4 border-soleil bg-soleil-soft p-3">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-bold">À surveiller :</span> {entry.alertNote}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
