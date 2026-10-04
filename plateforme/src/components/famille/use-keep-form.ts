"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Envoie un formulaire à une Server Action SANS le vider.
 * React 19 réinitialise un <form action={…}> après chaque envoi : en cas d'erreur,
 * la personne perdrait sa saisie. Ce gestionnaire garde les valeurs.
 */
export function useKeepForm(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
