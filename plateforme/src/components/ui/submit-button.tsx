"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/** Bouton d'envoi de formulaire : désactivé et annoncé pendant l'envoi. */
export function SubmitButton({
  children,
  pendingLabel = "Envoi…",
  variant,
  size,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending} name={name} value={value}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
