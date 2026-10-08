"use client";

import { useId, useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * Mot du glossaire (A11) : le mot, puis un bouton « ? » (24 px) qui affiche la définition au toucher ou au clic.
 * Au survol, l'attribut title montre aussi la définition.
 * La définition s'affiche dans le flux du texte (pas de bulle flottante) : aucun débordement à 360 px ni à 200 %.
 * Échap referme la définition.
 */
export function Term({ id, children }: { id: GlossaryKey; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const domId = useId();
  const entry = GLOSSARY[id];
  return (
    <>
      {children ?? entry.term}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={domId}
        title={entry.definition}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="relative ml-1 inline-flex size-6 before:absolute before:-inset-2.5 before:content-[''] shrink-0 items-center justify-center rounded-full border-2 border-mer bg-surface align-middle font-sans text-sm leading-none font-bold text-mer"
      >
        <span aria-hidden="true">?</span>
        <span className="sr-only">Qu&apos;est-ce que « {entry.term} » ?</span>
      </button>
      <span
        id={domId}
        hidden={!open}
        className="my-1 block rounded-lg border-l-4 border-mer bg-mer-soft px-3 py-2 font-sans text-base font-normal text-fg"
      >
        <strong>{entry.term} :</strong> {entry.definition}
      </span>
    </>
  );
}
