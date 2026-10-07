"use client";

import { resetPasswordAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";

export function NewPasswordForm({ token }: { token: string }) {
  const { state, onSubmit, pending } = useFormAction(resetPasswordAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <FormField label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum. Évitez un mot de passe courant." errors={fe?.password} required>
        <Input {...fieldA11y("password", fe?.password, true)} type="password" autoComplete="new-password" minLength={10} required />
      </FormField>
      <FormField label="Confirmez le mot de passe" htmlFor="confirm" errors={fe?.confirm} required>
        <Input {...fieldA11y("confirm", fe?.confirm)} type="password" autoComplete="new-password" minLength={10} required />
      </FormField>
      <p className="text-[15px] text-muted">Après le changement, toutes vos connexions sont fermées (site et application).</p>
      <PendingButton pending={pending} size="lg" className="w-full" pendingLabel="Enregistrement…">
        Enregistrer le mot de passe
      </PendingButton>
    </form>
  );
}
