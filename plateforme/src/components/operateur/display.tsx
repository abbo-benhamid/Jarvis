import Link from "next/link";
import type { ProofFactor } from "@prisma/client";
import { ArrowRight, Check, ChevronLeft, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DAY_LABELS, PROOF_FACTOR_LABELS, SLOT_LABELS } from "@/lib/labels";
import type { SlotRef } from "@/server/rules/matching";

export type TileTone = "calme" | "action";

/** Carte coton dense du back-office (rayon 24, ombre unique, 16 px de marge intérieure). */
export const OPS_CARD = "rounded-card bg-surface text-fg shadow-card";

/**
 * Compteur du tableau de bord. « action » = quelque chose attend l'opérateur.
 * L'information ne passe jamais par la couleur seule : un texte dit « À traiter » ou « Rien à faire ».
 * Le chiffre est un texte (Figtree tabulaire, 600), sans décor.
 */
export function StatTile({ label, count, href, hint }: { label: string; count: number; href: string; hint?: string }) {
  const tone: TileTone = count > 0 ? "action" : "calme";
  return (
    <Link
      href={href}
      className={cn(
        OPS_CARD,
        "group relative flex min-h-28 flex-col justify-between gap-3 overflow-hidden lg:min-h-36 p-5 no-underline transition-colors duration-[120ms] hover:bg-surface-2/50",
      )}
    >
      {tone === "action" ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-soleil" /> : null}
      <span className="flex flex-col gap-1">
        <span className="text-[15px] leading-snug font-semibold">{label}</span>
        {hint ? <span className="text-sm leading-snug text-muted">{hint}</span> : null}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="num text-[40px] leading-none font-semibold tracking-[-.02em]" data-testid="stat-count">
          {count}
        </span>
        {tone === "action" ? (
          <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-soleil-soft px-2.5 text-sm font-semibold text-soleil-ink">
            À traiter
            <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-[120ms] group-hover:translate-x-0.5" strokeWidth={1.8} />
          </span>
        ) : (
          <span className="text-sm font-semibold text-muted">Rien à faire</span>
        )}
      </span>
    </Link>
  );
}

/** Chiffre clé sans lien (Mesure du test, Retours) : libellé `muted`, chiffre tabulaire, précision. Dans un <dl>. */
export function KpiTile({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn(OPS_CARD, "flex flex-col gap-1.5 p-5", className)}>
      <dt className="text-[14px] leading-snug font-semibold text-muted">{label}</dt>
      <dd className="num m-0 text-[32px] leading-none font-semibold tracking-[-.02em]">{value}</dd>
      {hint ? <dd className="m-0 text-sm leading-snug text-muted">{hint}</dd> : null}
    </div>
  );
}

/** Panneau titré du back-office : titre 17 px 600, action à droite, contenu. */
export function Panel({
  id,
  title,
  action,
  description,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn(OPS_CARD, "flex flex-col p-5 lg:p-6", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="m-0 font-sans text-[17px] leading-snug font-semibold tracking-normal">
          {title}
        </h2>
        {action}
      </div>
      {description ? <p className="-mt-1 mb-3 text-sm leading-snug text-muted">{description}</p> : null}
      {children}
    </section>
  );
}

/** Lien d'action discret (texte mer, flèche), zone 44 px. */
export function MoreLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-mer no-underline hover:underline", className)}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.8} />
    </Link>
  );
}

/**
 * Tableau du back-office : en-tête discret en majuscules, lignes aérées.
 * L1d (M11) : sous 640 px, chaque ligne devient une CARTE (libellé au-dessus de chaque valeur, action en bas).
 * Les rôles ARIA gardent la structure de tableau pour les lecteurs d'écran.
 */
export function DataTable({
  head,
  rows,
  caption,
  minWidth,
}: {
  head: string[];
  rows: ReactNode[][];
  caption?: string;
  /** Largeur minimale à partir de 640 px (ex. « 40rem ») : le tableau défile dans son cadre, jamais la page. */
  minWidth?: string;
}) {
  return (
    <div className="sm:-mx-1 sm:overflow-x-auto sm:px-1">
      <table
        role="table"
        className="w-full border-collapse text-left text-[15px] max-sm:block sm:min-w-[var(--kd-table-min)]"
        style={minWidth ? ({ "--kd-table-min": minWidth } as React.CSSProperties) : undefined}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="max-sm:sr-only">
          <tr role="row" className="border-b border-line">
            {head.map((h) => (
              <th key={h} role="columnheader" scope="col" className="py-2.5 pr-4 text-[12.5px] font-semibold tracking-[.08em] whitespace-nowrap text-muted uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-sm:flex max-sm:flex-col max-sm:gap-3">
          {rows.map((r, i) => (
            <tr
              key={i}
              role="row"
              className="border-b border-line align-top last:border-0 max-sm:flex max-sm:flex-col max-sm:gap-2 max-sm:rounded-card max-sm:border-0 max-sm:bg-surface-2/60 max-sm:p-4"
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  role="cell"
                  data-label={head[j]}
                  className="num py-3 pr-4 break-words max-sm:block max-sm:p-0 max-sm:before:mb-0.5 max-sm:before:block max-sm:before:text-[13.5px] max-sm:before:font-semibold max-sm:before:tracking-[.04em] max-sm:before:text-muted max-sm:before:uppercase max-sm:before:content-[attr(data-label)]"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ALL_FACTORS: ProofFactor[] = ["GPS", "CODE_DOMICILE", "CONFIRMATION_AINE"];

/** Les 3 facteurs de preuve, avec pastille ET texte (valide / non valide / absent). */
export function ProofFactors({
  proofs,
}: {
  proofs: { factor: ProofFactor; valid: boolean; simulated: boolean; distanceMeters?: number | null }[];
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
      {ALL_FACTORS.map((f) => {
        const p = proofs.find((x) => x.factor === f);
        const state = !p ? "absent" : p.valid ? "valide" : "non valide";
        const Icon = !p ? Minus : p.valid ? Check : X;
        return (
          <li key={f} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-px grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5",
                p?.valid ? "bg-feuille-soft text-feuille" : p ? "bg-hibiscus-soft text-hibiscus" : "bg-surface-2 text-muted",
              )}
            >
              <Icon strokeWidth={2} />
            </span>
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
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-[15px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-fg">{children}</dd>
    </div>
  );
}

/** Lien de retour vers une liste. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-icon px-2 text-[15px] font-semibold text-mer no-underline hover:bg-mer-soft">
      <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
      {children}
    </Link>
  );
}
