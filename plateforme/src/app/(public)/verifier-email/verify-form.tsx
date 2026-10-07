"use client";

import { verifyEmailAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";

export function VerifyEmailForm({ token }: { token: string }) {
  const { state, onSubmit, pending } = useFormAction(verifyEmailAction, initialActionState);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" className="w-full" pendingLabel="Confirmation…">
        Confirmer mon adresse
      </PendingButton>
    </form>
  );
}
