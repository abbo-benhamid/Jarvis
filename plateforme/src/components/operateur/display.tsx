import Link from "next/link";
import type { ProofFactor } from "@prisma/client";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { DAY_LABELS, PROOF_FACTOR_LABELS, SLOT_LABELS } from "@/lib/labels";
import type { SlotRef } from "@/server/rules/matching";

export type TileTone = "calme" | "action";

/**
 * Compteur du tableau de bord. « action » = quelque chose attend l'opérateur.
 * L'information ne passe jamais par la couleur seule : un texte dit « À traiter » ou « Rien à faire ».
 */
export function StatTile({ label, count, href, hint }: { label: string; count: number; href: string; hint?: string }) {
  const tone: TileTone = count > 0 ? "action" : "calme";
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-28 flex-col justify-between gap-2 rounded-xl border bg-surface p-4 shadow-sm hover:bg-mer-soft",
        tone === "action" ? "border-soleil border-l-8" : "border-line",
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className="flex items-end justify-between gap-2">
        <span className="font-display text-4xl font-extrabold tabular-nums" data-testid="stat-count">
          {count}
        </span>
        <span className={cn("text-sm font-semibold", tone === "action" ? "text-fg" : "text-muted")}>
          {tone === "action" ? "À traiter →" : "Rien à faire"}
        </span>
      </span>
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </Link>
  );
}

const ALL_FACTORS: ProofFactor[] = ["GPS", "CODE_DOMICILE", "CONFIRMATION_AINE"];

/** Les 3 facteurs de preuve, avec icône ET texte (valide / non valide / absent). */
export function ProofFactors({
  proofs,
}: {
  proofs: { factor: ProofFactor; valid: boolean; simulated: boolean; distanceMeters?: number | null }[];
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {ALL_FACTORS.map((f) => {
        const p = proofs.find((x) => x.factor === f);
        const state = !p ? "absent" : p.valid ? "valide" : "non valide";
        const Icon = !p ? CircleDashed : p.valid ? CheckCircle2 : XCircle;
        return (
          <li key={f} className="flex items-start gap-2">
            <Icon aria-hidden="true" size={18} className={cn("mt-0.5 shrink-0", p?.valid ? "text-feuille" : p ? "text-hibiscus" : "text-muted")} />
            <span>
              {PROOF_FACTOR_LABELS[f]} : <strong>{state}</strong>
              {p?.simulated ? " (simulé)" : ""}
              {f === "GPS" && p?.distanceMeters != null ? ` — ${Math.round(p.distanceMeters)} m du domicile` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function slotText(s: SlotRef): string {
  return `${DAY_LABELS[s.dayOfWeek] ?? "?"} ${SLOT_LABELS[s.slot].toLowerCase()}`;
}

export function SlotList({ slots, empty = "Aucun créneau précis" }: { slots: SlotRef[]; empty?: string }) {
  if (slots.length === 0) return <span className="text-muted">{empty}</span>;
  return <span>{slots.map(slotText).join(", ")}</span>;
}

/** Ligne « libellé : valeur » pour les fiches. */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr]">
      <dt className="font-semibold">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  );
}

/** Lien de retour vers une liste. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex min-h-11 items-center font-semibold text-mer underline">
      ← {children}
    </Link>
  );
}
