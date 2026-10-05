"use client";

import { linkToAineAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** A6 (D7) : le proche aidant confirme son rattachement à son aîné. */
export function LinkToAineForm({ token, aineFirstName }: { token: string; aineFirstName: string }) {
  const { state, onSubmit, pending } = useFormAction(linkToAineAction, initialActionState);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <PendingButton pending={pending} pendingLabel="Rattachement…" className="sm:self-start">
        Me rattacher à {aineFirstName}
      </PendingButton>
    </form>
  );
}
