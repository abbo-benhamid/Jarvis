"use client";

import { withdrawDiscoveryByTokenAction } from "@/server/sandbox/actions";
import { initialActionState } from "@/lib/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** M6 : retrait du consentement par lien (sans compte). Un clic confirme : jamais d'effacement sur un simple GET. */
export function WithdrawConsentForm({ token }: { token: string }) {
  const { state, onSubmit, pending } = useFormAction(withdrawDiscoveryByTokenAction, initialActionState);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <PendingButton pending={pending} pendingLabel="Effacement…" className="sm:self-start">
        Retirer mon accord et effacer mon contact
      </PendingButton>
    </form>
  );
}
