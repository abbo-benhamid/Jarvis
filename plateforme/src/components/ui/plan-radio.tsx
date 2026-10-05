"use client";

import { Check } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./badge";

export type PlanOption = {
  value: string;
  /** Nom de la formule, ex. « Sérénité ». */
  name: string;
  /** Prix affiché (tabulaire), ex. « 149 € ». */
  price: ReactNode;
  /** Avant le prix, en petit, ex. « dès ». */
  pricePrefix?: ReactNode;
  /** Après le prix, en petit, ex. « / mois ». */
  priceSuffix?: ReactNode;
  description?: ReactNode;
  /** Avantages, montrés quand la formule est choisie. */
  features?: ReactNode[];
  /** Badge soleil à cheval sur le bord haut, ex. « Conseillé pour Léonie ». */
  tag?: string;
  disabled?: boolean;
};

/** Mention obligatoire à chaque affichage de prix (direction artistique § 10). */
export const PLAN_NOTICE = "Offre en test, non commercialisée.";

/**
 * Choix de formule (§ 10) : carte radio 20 px, bord 1,5 px `mer` quand choisie, radio pleine `mer`,
 * prix tabulaire à droite, badge « Conseillé » à cheval sur le bord haut.
 * Radios natives dans un <fieldset> : flèches du clavier, envoi de formulaire (name/value), lecteurs d'écran.
 * Non contrôlé (`defaultValue`) ou contrôlé (`value` + `onValueChange`).
 */
export function PlanRadio({
  name,
  legend,
  legendHidden = false,
  options,
  value,
  defaultValue,
  onValueChange,
  notice = PLAN_NOTICE,
  required,
  className,
}: {
  /** Nom du champ envoyé avec le formulaire. */
  name: string;
  legend: ReactNode;
  /** Légende lue par les lecteurs d'écran seulement (quand le titre de la page la dit déjà). */
  legendHidden?: boolean;
  options: PlanOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Mention sous les formules. `null` pour la masquer (si elle est déjà ailleurs sur l'écran). */
  notice?: ReactNode | null;
  required?: boolean;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const selected = value ?? inner;
  const base = useId();
  const noticeId = `${base}-notice`;
  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)} aria-describedby={notice ? noticeId : undefined}>
      <legend className={cn(legendHidden ? "sr-only" : "mb-3 text-[17px] font-semibold")}>{legend}</legend>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => {
          const id = `${base}-${o.value}`;
          const on = selected === o.value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "relative flex cursor-pointer items-start gap-3.5 rounded-lg border-[1.5px] bg-surface px-[18px] py-4 text-fg shadow-card transition-colors duration-[120ms]",
                on ? "border-mer" : "border-transparent hover:border-line",
                o.tag && "mt-2",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid has-[:focus-visible]:shadow-[0_0_0_5px_var(--focus-halo)]",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                disabled={o.disabled}
                required={required}
                onChange={() => {
                  setInner(o.value);
                  onValueChange?.(o.value);
                }}
                className="peer sr-only"
              />
              {o.tag ? (
                <Badge tone="soleil" className="absolute -top-[11px] right-4">
                  {o.tag}
                </Badge>
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-6 shrink-0 rounded-full transition-shadow duration-[120ms]",
                  on ? "shadow-[inset_0_0_0_7px_var(--mer)]" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <b className="text-[17px] font-semibold">{o.name}</b>
                  <span className="num text-[17px] font-semibold whitespace-nowrap">
                    {o.pricePrefix ? <small className="text-[13.5px] font-medium text-muted">{o.pricePrefix} </small> : null}
                    {o.price}
                    {o.priceSuffix ? <small className="text-[13.5px] font-medium text-muted"> {o.priceSuffix}</small> : null}
                  </span>
                </span>
                {o.description ? <span className="mt-0.5 block text-[14.5px] leading-[1.4] text-muted">{o.description}</span> : null}
                {on && o.features && o.features.length > 0 ? (
                  <ul className="m-0 mt-3 grid list-none gap-1.5 border-t border-line p-0 pt-3">
                    {o.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[14.5px] leading-[1.35]">
                        <Check aria-hidden="true" className="mt-px size-4 shrink-0 text-feuille" strokeWidth={1.8} />
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {notice ? (
        <p id={noticeId} className="mx-1 mt-3.5 text-[13.5px] leading-[1.4] text-muted">
          {notice}
        </p>
      ) : null}
    </fieldset>
  );
}
