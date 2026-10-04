"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/**
 * SOCLE — hook commun à TOUS les formulaires (connexion, inscription, avis, familles, accompagnants).
 * Envoie un formulaire à une Server Action SANS la réinitialisation automatique de React 19.
 * Raison : avec `<form action>`, React remet les champs à leur valeur par défaut après l'envoi.
 * Les champs contrôlés (cases cochées, textes) gardent alors un état React différent du DOM,
 * et un 2e envoi perd des données (ex. communes décochées). Ici, rien n'est réinitialisé.
 */
export function useFormAction<S>(action: (prev: S, formData: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(
    action as (prev: Awaited<S>, formData: FormData) => Promise<S>,
    initial as Awaited<S>,
  );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return { state, onSubmit, pending, dispatch };
}

/** Bouton d'envoi lié à `pending` de useFormAction (désactivé et annoncé pendant l'envoi). */
export function PendingButton({
  pending,
  pendingLabel = "Envoi…",
  children,
  variant,
  size,
  className,
}: {
  pending: boolean;
  pendingLabel?: string;
  children: React.ReactNode;
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
