"use client";

import { loginAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";

export function LoginForm({ next }: { next?: string }) {
  // Hook du socle : la saisie reste en place après une erreur (pas de remise à zéro par React 19).
  const { state, onSubmit, pending } = useFormAction(loginAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField label="Email" htmlFor="email" errors={fe?.email} required>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </FormField>
      <FormField label="Mot de passe" htmlFor="password" errors={fe?.password} required>
        <Input {...fieldA11y("password", fe?.password)} type="password" autoComplete="current-password" required />
      </FormField>
      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" className="w-full" pendingLabel="Connexion…">
        Se connecter
      </PendingButton>
    </form>
  );
}
