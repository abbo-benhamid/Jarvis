"use client";

import { useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Lien en lecture seule + bouton « Copier ». L'état est annoncé aux lecteurs d'écran. */
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="block min-h-11 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm text-fg"
        />
        <Button variant="secondary" onClick={copy} className="shrink-0">
          {status === "copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {status === "copied" ? "Lien copié" : "Copier le lien"}
        </Button>
      </div>
      <p aria-live="polite" className="text-sm text-muted">
        {status === "copied" ? "Le lien est copié. Collez-le dans WhatsApp, un SMS ou un email." : null}
        {status === "manual" ? "Copie automatique impossible. Le lien est sélectionné : copiez-le avec votre téléphone." : null}
      </p>
    </div>
  );
}
