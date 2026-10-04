"use client";

import { useActionState, useState } from "react";
import { registerAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { FAMILY_LOCATION_LABELS } from "@/lib/labels";

type RoleChoice = "FAMILLE" | "ACCOMPAGNANT";

export function RegisterForm({ defaultRole }: { defaultRole: RoleChoice }) {
  const [state, action] = useActionState(registerAction, initialActionState);
  const [role, setRole] = useState<RoleChoice>(defaultRole);
  const fe = !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Fieldset legend="Je crée un compte…" errors={fe?.role}>
        <Radio
          id="role-famille"
          name="role"
          value="FAMILLE"
          checked={role === "FAMILLE"}
          onChange={() => setRole("FAMILLE")}
          label={<><strong>Famille</strong> — je veille sur un parent âgé.</>}
        />
        <Radio
          id="role-accompagnant"
          name="role"
          value="ACCOMPAGNANT"
          checked={role === "ACCOMPAGNANT"}
          onChange={() => setRole("ACCOMPAGNANT")}
          label={<><strong>Accompagnant</strong> — je veux accompagner des aînés.</>}
        />
      </Fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Prénom" htmlFor="firstName" errors={fe?.firstName} required>
          <Input {...fieldA11y("firstName", fe?.firstName)} autoComplete="given-name" required />
        </FormField>
        <FormField label="Nom" htmlFor="lastName" errors={fe?.lastName} required>
          <Input {...fieldA11y("lastName", fe?.lastName)} autoComplete="family-name" required />
        </FormField>
      </div>
      <FormField label="Email" htmlFor="email" errors={fe?.email} required>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </FormField>
      <FormField label="Mot de passe" htmlFor="password" hint="8 caractères minimum." errors={fe?.password} required>
        <Input {...fieldA11y("password", fe?.password, true)} type="password" autoComplete="new-password" minLength={8} required />
      </FormField>
      {role === "FAMILLE" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="J'habite" htmlFor="location" errors={fe?.location} required>
            <Select {...fieldA11y("location", fe?.location)} defaultValue="" required>
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(FAMILY_LOCATION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Ville (facultatif)" htmlFor="city" errors={fe?.city}>
            <Input {...fieldA11y("city", fe?.city)} autoComplete="address-level2" />
          </FormField>
        </div>
      ) : null}
      <Checkbox
        id="acceptTest"
        name="acceptTest"
        label="Je comprends que Koudmen est en test. J'utilise uniquement des données fictives (pas de vrais noms d'aînés, pas d'informations de santé)."
        required
      />
      {fe?.acceptTest ? (
        <p className="text-sm font-semibold text-hibiscus" role="alert">
          {fe.acceptTest.join(" ")}
        </p>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Création…">Créer mon compte</SubmitButton>
    </form>
  );
}
