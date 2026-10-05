import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutre" | "mer" | "soleil" | "hibiscus" | "feuille";

const TONES: Record<BadgeTone, string> = {
  neutre: "bg-surface-2 text-fg",
  mer: "bg-mer-soft text-mer",
  soleil: "bg-soleil-soft text-soleil-ink",
  hibiscus: "bg-hibiscus-soft text-hibiscus",
  feuille: "bg-feuille-soft text-feuille",
};

/**
 * Étiquette de statut : pilule 28 px, 14 px 600.
 * Ne transmet jamais l'info par la couleur seule : le texte suffit.
 */
export function Badge({
  tone = "neutre",
  icon,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Icône 16 px décorative, avant le texte. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full py-0.5 text-sm leading-tight font-semibold whitespace-nowrap",
        icon ? "pr-2.5 pl-2" : "px-2.5",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        TONES[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden="true" className="contents">{icon}</span> : null}
      {children}
    </span>
  );
}

/** Badge de preuve (§ 10). preuve = « Prouvée » (feuille), a-faire / conseille (soleil), neutre. */
export type ProofBadgeStatus = "preuve" | "a-faire" | "conseille" | "neutre";

const PROOF: Record<ProofBadgeStatus, { tone: BadgeTone; label: string }> = {
  preuve: { tone: "feuille", label: "Prouvée" },
  "a-faire": { tone: "soleil", label: "À faire" },
  conseille: { tone: "soleil", label: "Conseillé" },
  neutre: { tone: "neutre", label: "En attente" },
};

/** Le mot est obligatoire : la couleur seule ne suffit pas. `children` remplace le libellé par défaut. */
export function ProofBadge({ status = "preuve", children, className }: { status?: ProofBadgeStatus; children?: ReactNode; className?: string }) {
  const p = PROOF[status];
  return (
    <Badge tone={p.tone} icon={status === "preuve" ? <ShieldCheck strokeWidth={1.8} /> : undefined} className={className}>
      {children ?? p.label}
    </Badge>
  );
}
