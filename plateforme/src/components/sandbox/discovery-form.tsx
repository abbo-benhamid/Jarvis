"use client";

import { requestDiscoveryAction } from "@/server/sandbox/actions";
import { initialActionState } from "@/lib/action-result";
import { DISCOVERY_CONSENT_TEXT } from "@/lib/measure";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** Contact RÉEL du testeur + case de consentement explicite (jamais pré-cochée). Aucune donnée sur l'aîné. */
export function DiscoveryForm() {
  const { state, onSubmit, pending } = useFormAction(requestDiscoveryAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        Ici, écrivez VOTRE vrai contact (pas celui de votre parent). N&apos;écrivez aucune information sur votre parent.
      </p>
      <FormField label="Votre prénom" htmlFor="name" errors={fe?.name} required>
        <Input {...fieldA11y("name", fe?.name)} autoComplete="given-name" maxLength={80} required />
      </FormField>
      <FormField label="Votre email ou votre téléphone" htmlFor="contact" errors={fe?.contact} required>
        <Input {...fieldA11y("contact", fe?.contact)} autoComplete="email" maxLength={120} required />
      </FormField>
      <Checkbox id="consent" name="consent" label={DISCOVERY_CONSENT_TEXT} required />
      {fe?.consent ? <p className="text-sm font-semibold text-hibiscus">{fe.consent.join(" ")}</p> : null}
      <FormMessage state={state} />
      <PendingButton pending={pending} pendingLabel="Envoi…" className="sm:self-start">
        Être recontacté(e)
      </PendingButton>
    </form>
  );
}
