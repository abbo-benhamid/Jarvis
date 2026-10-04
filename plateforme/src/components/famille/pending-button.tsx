"use client";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/** Bouton d'envoi piloté par `isPending` (useActionState), pour les formulaires qui gardent leur saisie. */
export function PendingButton({
  pending,
  children,
  pendingLabel = "Envoi…",
  variant,
  size,
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
