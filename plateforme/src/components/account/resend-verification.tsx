"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";

/** L3 : renvoi du lien de vérification (3 par heure). */
export function ResendVerificationButton() {
  const [state, action, pending] = useActionState(resendVerificationAction, initialActionState);
  return (
    <form action={action} className="mt-2 flex flex-col gap-1">
      <Button type="submit" variant="quiet" disabled={pending} aria-busy={pending}>
        {pending ? "Envoi…" : "Renvoyer le lien"}
      </Button>
      <p role="status" className="text-sm">
        {state.ok ? state.message : state.error}
      </p>
    </form>
  );
}
