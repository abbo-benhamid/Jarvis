"use client";

import { joinWaitlistAction } from "@/server/waitlist-actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";
import { LISTE_ATTENTE_CONSENTEMENT_TEXTE } from "@/contracts/v1/territoires";
import { TERRITOIRES_BIENTOT, territoire, type CodeTerritoire } from "@/lib/territoires";

/** T1 (T2) : e-mail + territoire « Bientôt » + case de consentement NON cochée par défaut. */
export function WaitlistForm({ initial }: { initial: CodeTerritoire }) {
  const { state, onSubmit, pending } = useFormAction(joinWaitlistAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <FormField label="Territoire" htmlFor="territoire" errors={fe?.territoire} required>
        <Select {...fieldA11y("territoire", fe?.territoire)} defaultValue={initial}>
          {TERRITOIRES_BIENTOT.map((t) => (
            <option key={t} value={t}>
              {territoire(t).nom}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Adresse e-mail" htmlFor="email" errors={fe?.email} required>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </FormField>
      <Fieldset legend="Votre accord" errors={fe?.consentement}>
        <Checkbox id="consentement" name="consentement" label={LISTE_ATTENTE_CONSENTEMENT_TEXTE} aria-invalid={fe?.consentement ? true : undefined} />
      </Fieldset>
      <PendingButton pending={pending} size="lg" className="w-full" pendingLabel="Envoi…">
        M&apos;inscrire sur la liste d&apos;attente
      </PendingButton>
    </form>
  );
}
