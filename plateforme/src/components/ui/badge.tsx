import { cn } from "@/lib/cn";

export type BadgeTone = "neutre" | "mer" | "soleil" | "hibiscus" | "feuille";

const TONES: Record<BadgeTone, string> = {
  neutre: "bg-bg text-muted border-line",
  mer: "bg-mer-soft text-mer border-transparent",
  soleil: "bg-soleil-soft text-fg border-transparent",
  hibiscus: "bg-hibiscus-soft text-hibiscus border-transparent",
  feuille: "bg-feuille-soft text-feuille border-transparent",
};

/** Étiquette de statut. Ne transmet jamais l'info par la couleur seule : le texte suffit. */
export function Badge({ tone = "neutre", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}
