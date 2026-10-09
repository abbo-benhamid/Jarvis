"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * P1 : « Inviter un proche ». Partage le lien d'inscription au site (Web Share API, copie, WhatsApp).
 * Koudmen ne demande PAS l'e-mail du proche : la famille envoie le lien elle-même, par son canal habituel.
 */
export function InviteShare({ url }: { url: string }) {
  const [canShare, setCanShare] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "shared" | "manual">("idle");
  const text = "Je prépare l'arrivée de Koudmen pour notre parent en Guadeloupe. Inscris-toi aussi, c'est gratuit :";

  useEffect(() => {
    try {
      setCanShare(typeof navigator.share === "function");
    } catch {
      setCanShare(false);
    }
  }, []);

  async function share() {
    try {
      await navigator.share({ title: "Koudmen", text, url });
      setStatus("shared");
    } catch {
      // Partage annulé par la personne : rien à dire.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md bg-surface-2 px-3.5 py-3 font-mono text-sm break-all text-fg" data-testid="lien-invitation">
        {url}
      </p>
      <div className="grid gap-2.5">
        {canShare ? (
          <Button variant="primary" size="lg" fullWidth onClick={share} icon={<Share2 strokeWidth={1.8} />}>
            Partager le lien
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="quiet" onClick={copy} icon={status === "copied" ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}>
            {status === "copied" ? "Copié" : "Copier"}
            <span className="sr-only"> le lien d&apos;inscription</span>
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("quiet", "md")}
          >
            WhatsApp
            <span className="sr-only"> : envoyer le lien (nouvelle fenêtre)</span>
          </a>
        </div>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {status === "copied" ? "Le lien est copié. Collez-le dans un message." : null}
        {status === "shared" ? "Merci. Votre proche peut créer son compte." : null}
        {status === "manual" ? "Copie impossible ici. Appuyez longuement sur le lien pour le copier." : null}
      </p>
    </div>
  );
}
