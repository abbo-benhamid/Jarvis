"use client";

import { useActionState } from "react";
import { chooseProfileAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/** D6 : la famille choisit un profil. Succès : redirection avec un message en haut de page. */
export function ChooseProfileForm({ proposalId, name }: { proposalId: string; name: string }) {
  const [state, action] = useActionState(chooseProfileAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="proposalId" value={proposalId} />
      <SubmitButton pendingLabel="Envoi…" className="sm:self-start">
        {`Choisir ${name}`}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
