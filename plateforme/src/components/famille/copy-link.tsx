"use client";

import { useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * Lien en lecture seule + bouton « Copier » + « Envoyer par WhatsApp » (S1b-ux m13 : le canal naturel de la diaspora).
 * L'état est annoncé aux lecteurs d'écran.
 */
export function CopyLink({ value, label = "Lien d'invitation" }: { value: string; label?: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      inputRef.current?.select();
      setStatus("manual");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="block min-h-12 w-full rounded-md border-[1.5px] border-line-strong bg-surface-2 px-3 py-2 font-mono text-sm text-fg"
        />
        <Button variant="quiet" onClick={copy} className="w-full">
          {status === "copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {status === "copied" ? "Lien copié" : "Copier le lien"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Rejoins le cercle Koudmen : ${value}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("quiet", "md", "w-full")}
        >
          Envoyer par WhatsApp
          <span className="sr-only"> (nouvelle fenêtre)</span>
        </a>
      </div>
      <p aria-live="polite" className="text-sm text-muted">
        {status === "copied" ? "Le lien est copié. Collez-le dans WhatsApp, un SMS ou un email." : null}
        {status === "manual" ? "Copie automatique impossible. Le lien est sélectionné : copiez-le avec votre téléphone." : null}
      </p>
    </div>
  );
}
