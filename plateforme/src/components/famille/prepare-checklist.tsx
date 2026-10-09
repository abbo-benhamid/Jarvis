"use client";

import { useEffect, useId, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { libelleAvancement, lireCoches, PREPARER_ITEMS, PREPARER_STORAGE_KEY, type PreparerId } from "@/lib/preinscription";

function load(): PreparerId[] {
  try {
    return lireCoches(window.localStorage.getItem(PREPARER_STORAGE_KEY));
  } catch {
    return [];
  }
}

function save(ids: PreparerId[]) {
  try {
    window.localStorage.setItem(PREPARER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Navigation privée, stockage plein ou bloqué : la liste marche, elle n'est pas gardée.
  }
}

/**
 * P1 : « Préparer l'arrivée ». Cases à cocher, gardées SUR CET APPAREIL (localStorage), jamais envoyées à Koudmen.
 * Aucun champ libre : la famille n'écrit rien sur son parent (R1).
 * Vraies cases à cocher (clavier, lecteurs d'écran), cible ≥ 44 px, avancement annoncé poliment.
 */
export function PrepareChecklist({ headingId }: { headingId: string }) {
  const [done, setDone] = useState<PreparerId[]>([]);
  const [ready, setReady] = useState(false);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    setDone(load());
    setReady(true);
  }, []);

  function toggle(id: PreparerId, checked: boolean) {
    setDone((prev) => {
      const next = checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id);
      save(next);
      return next;
    });
  }

  const count = done.length;
  const total = PREPARER_ITEMS.length;

  return (
    <div className="rounded-card bg-surface shadow-card" data-testid="preparer-arrivee">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-feuille transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${(count / total) * 100}%` }}
          />
        </div>
        <p aria-live="polite" className="num shrink-0 text-[15px] font-semibold" data-testid="preparer-avancement">
          {ready ? libelleAvancement(count, total) : " "}
        </p>
      </div>
      <ul aria-labelledby={headingId} className="m-0 list-none p-0">
        {PREPARER_ITEMS.map((item) => {
          const checked = done.includes(item.id);
          const id = `prep-${item.id}-${uid}`;
          return (
            <li key={item.id} className="border-t border-line">
              <label htmlFor={id} className="relative flex min-h-14 cursor-pointer items-start gap-3.5 px-5 py-3.5">
                <input id={id} type="checkbox" className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0" checked={checked} onChange={(e) => toggle(item.id, e.currentTarget.checked)} />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
                    "peer-focus-visible:[outline:3px_solid_var(--focus)] peer-focus-visible:[outline-offset:2px]",
                    checked ? "bg-feuille text-surface" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]",
                  )}
                >
                  {checked ? <Check className="size-4" strokeWidth={2.2} /> : null}
                </span>
                <span className="min-w-0">
                  <b className={cn("block text-base leading-snug font-semibold", checked && "text-muted line-through decoration-1")}>{item.title}</b>
                  <span className="mt-0.5 block text-[15px] leading-[1.45] text-muted">{item.text}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-5 py-3.5 text-sm text-muted">Cette liste reste sur votre téléphone. Koudmen ne la reçoit pas.</p>
    </div>
  );
}
