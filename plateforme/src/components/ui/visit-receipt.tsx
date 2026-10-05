import { Check, Minus, ShieldCheck, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MadrasLine } from "./card";

export type ReceiptProof = {
  label: ReactNode;
  /** Précision, ex. « À 12 m de la maison ». */
  detail?: ReactNode;
  /** Heure affichée, ex. « 10:04 ». */
  time?: string;
  /** Valeur machine de <time>, ex. « 2026-10-03T10:04 ». */
  dateTime?: string;
  obtained: boolean;
};

/** Seuil de validation : 2 preuves sur 3 suffisent (spécification V1). */
export const PROOFS_REQUIRED = 2;

/** Verdict par défaut : « 2 preuves sur 3 · visite validée » ou « 1 preuve sur 3 · à vérifier ». */
export function receiptVerdict(proofs: Pick<ReceiptProof, "obtained">[], required = PROOFS_REQUIRED) {
  const n = proofs.filter((p) => p.obtained).length;
  const valid = n >= required;
  return { valid, title: `${n} ${n > 1 ? "preuves" : "preuve"} sur ${proofs.length} · ${valid ? "visite validée" : "à vérifier"}` };
}

/**
 * Reçu de visite (§ 10) : filet madras 3 px en haut, code en mono, 3 heures tabulaires,
 * perforation pointillée avec encoches couleur `bg`, liste des preuves, verdict sur `feuille-soft`.
 * Il a la forme d'un ticket : on le comprend sans lire. Le texte dit tout (pas d'info par la couleur seule).
 */
export function VisitReceipt({
  code,
  times,
  proofs,
  verdictTitle,
  verdictText,
  required = PROOFS_REQUIRED,
  title = "Reçu de visite",
  headingLevel = 3,
  className,
}: {
  /** Référence du reçu, ex. « KDM-2610-0417 ». */
  code?: string;
  /** Trois colonnes, ex. Arrivée / Départ / Durée. */
  times: { label: string; value: string }[];
  proofs: ReceiptProof[];
  /** Remplace le verdict calculé. */
  verdictTitle?: ReactNode;
  /** Phrase sous le verdict, ex. « Deux preuves suffisent. Le paiement de Josiane part. » */
  verdictText?: ReactNode;
  required?: number;
  title?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const v = receiptVerdict(proofs, required);
  return (
    <section aria-label={title} className={cn("relative overflow-hidden rounded-[22px] bg-surface text-fg shadow-card", className)}>
      <MadrasLine thick />
      <div className="flex items-center justify-between gap-3 px-5 pt-[18px] pb-3.5">
        <H className="m-0 font-sans text-[17px] leading-snug font-semibold tracking-normal">{title}</H>
        {code ? <code className="font-mono text-[12.5px] leading-none font-medium tracking-[.04em] text-muted">{code}</code> : null}
      </div>
      <dl className="num grid grid-cols-3 px-5 pb-4">
        {times.map((t) => (
          <div key={t.label} className="flex flex-col-reverse">
            <dd className="m-0 text-xl leading-tight font-semibold">{t.value}</dd>
            <dt className="text-[13px] text-muted">{t.label}</dt>
          </div>
        ))}
      </dl>
      {/* Perforation : pointillés + deux encoches de 20 px couleur du fond. */}
      <div
        aria-hidden="true"
        className="relative mx-5 h-px border-t-[1.5px] border-dashed border-line before:absolute before:-top-[11px] before:-left-[31px] before:size-5 before:rounded-full before:bg-bg after:absolute after:-top-[11px] after:-right-[31px] after:size-5 after:rounded-full after:bg-bg"
      />
      <ul className="m-0 list-none px-5 pt-2 pb-1">
        {proofs.map((p, i) => (
          <li key={i} className={cn("flex min-h-[52px] items-center gap-3 py-1.5 text-base", i > 0 && "border-t border-line")}>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-4",
                p.obtained ? "bg-feuille-soft text-feuille" : "bg-surface-2 text-muted",
              )}
            >
              {p.obtained ? <Check aria-hidden="true" strokeWidth={1.8} /> : <Minus aria-hidden="true" strokeWidth={1.8} />}
              <span className="sr-only">{p.obtained ? "Preuve obtenue :" : "Preuve manquante :"}</span>
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              {p.label}
              {p.detail ? <small className="block text-[13.5px] leading-[1.3] text-muted">{p.detail}</small> : null}
            </span>
            {p.time ? (
              <time dateTime={p.dateTime} className="num text-sm text-muted">
                {p.time}
              </time>
            ) : null}
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "mx-3 mt-2 mb-3 flex items-center gap-3 rounded-md p-3.5 [&>svg]:size-6 [&>svg]:shrink-0",
          v.valid ? "bg-feuille-soft text-feuille" : "bg-soleil-soft text-soleil-ink",
        )}
      >
        {v.valid ? <ShieldCheck aria-hidden="true" strokeWidth={1.6} /> : <ShieldAlert aria-hidden="true" strokeWidth={1.6} />}
        <div>
          <b className="block text-base font-bold">{verdictTitle ?? v.title}</b>
          {verdictText ? <span className="text-sm text-fg opacity-80">{verdictText}</span> : null}
        </div>
      </div>
    </section>
  );
}
