"use client";

import { forgotPasswordAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";

export function ForgotPasswordForm() {
  const { state, onSubmit, pending } = useFormAction(forgotPasswordAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <FormField label="Email" htmlFor="email" errors={fe?.email} required>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </FormField>
      <PendingButton pending={pending} size="lg" className="w-full" pendingLabel="Envoi…">
        Recevoir un lien
      </PendingButton>
    </form>
  );
}
