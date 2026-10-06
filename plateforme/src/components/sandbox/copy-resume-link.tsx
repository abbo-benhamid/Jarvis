"use client";

import { useState } from "react";

/** Lien de reprise (D2) : à garder pour revenir dans son bac à sable depuis un autre appareil. */
export function CopyResumeLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full font-semibold">Votre lien de reprise :</span>
      <input
        readOnly
        value={url}
        aria-label="Lien de reprise de votre démo"
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 min-w-0 flex-1 basis-48 rounded-field border-[1.5px] border-line-strong bg-surface px-3 font-mono text-xs"
      />
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-icon px-3 font-semibold text-mer hover:bg-surface"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copié" : "Copier"}
      </button>
      <span className="w-full text-muted">Gardez ce lien secret : il ouvre votre démo sans mot de passe.</span>
    </div>
  );
}
