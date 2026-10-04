"use client";

import { useActionState } from "react";
import { PhoneCall } from "lucide-react";
import { confirmVisitAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/** F7 : « L'aîné a confirmé (appel simulé) ». Succès : redirection avec message en haut de page. */
export function ConfirmVisitForm({ visitId, aineFirstName }: { visitId: string; aineFirstName: string }) {
  const [state, action] = useActionState(confirmVisitAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="visitId" value={visitId} />
      <p className="text-sm text-muted">
        Test : Koudmen simule un appel à {aineFirstName}. Elle ou il répond « 1 » pour confirmer la visite.
      </p>
      <SubmitButton variant="soleil" pendingLabel="Appel simulé…" className="sm:self-start">
        <PhoneCall aria-hidden="true" className="size-4" />
        L&apos;aîné a confirmé (appel simulé)
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
