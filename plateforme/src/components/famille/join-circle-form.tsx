"use client";

import { useActionState } from "react";
import { joinCircleAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/** F10 : bouton « Rejoindre le cercle ». */
export function JoinCircleForm({ token, aineFirstName }: { token: string; aineFirstName: string }) {
  const [state, action] = useActionState(joinCircleAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Un instant…">
        Rejoindre le cercle de {aineFirstName}
      </SubmitButton>
    </form>
  );
}
