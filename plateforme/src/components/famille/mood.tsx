import { Annoyed, Frown, Laugh, Meh, Smile } from "lucide-react";
import { cn } from "@/lib/cn";
import { MOOD_LABELS } from "@/lib/labels";
import { moodTone, type MoodTone } from "@/server/famille/logic";

const ICONS = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh } as const;

/** Couleurs douces : jamais de rouge pour une humeur basse (non alarmiste). */
const TONE_CLASSES: Record<MoodTone, { bubble: string; dot: string }> = {
  bien: { bubble: "bg-feuille-soft text-feuille", dot: "bg-feuille" },
  moyen: { bubble: "bg-mer-soft text-mer", dot: "bg-mer" },
  bas: { bubble: "bg-soleil-soft text-fg", dot: "bg-soleil" },
};

function clampMood(mood: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, Math.round(mood))) as 1 | 2 | 3 | 4 | 5;
}

/** Pictogramme d'humeur (décoratif : le texte porte l'information). */
export function MoodIcon({ mood, size = "md" }: { mood: number; size?: "sm" | "md" | "lg" }) {
  const m = clampMood(mood);
  const Icon = ICONS[m];
  const tone = TONE_CLASSES[moodTone(m)];
  const dims = size === "lg" ? "size-14" : size === "sm" ? "size-9" : "size-11";
  const icon = size === "lg" ? "size-8" : size === "sm" ? "size-5" : "size-6";
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center rounded-full", dims, tone.bubble)}>
      <Icon className={icon} strokeWidth={2.25} />
    </span>
  );
}

/** Échelle 1-5 en points + texte « Bien (4 sur 5) ». */
export function MoodScale({ mood }: { mood: number }) {
  const m = clampMood(mood);
  const tone = TONE_CLASSES[moodTone(m)];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden="true" className="inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("size-2.5 rounded-full", i <= m ? tone.dot : "bg-line")} />
        ))}
      </span>
      <span>
        Humeur : {MOOD_LABELS[m]} ({m} sur 5)
      </span>
    </span>
  );
}
