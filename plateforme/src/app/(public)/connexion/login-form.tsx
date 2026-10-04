"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField label="Email" htmlFor="email" errors={fe?.email} required>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </FormField>
      <FormField label="Mot de passe" htmlFor="password" errors={fe?.password} required>
        <Input {...fieldA11y("password", fe?.password)} type="password" autoComplete="current-password" required />
      </FormField>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
    </form>
  );
}
