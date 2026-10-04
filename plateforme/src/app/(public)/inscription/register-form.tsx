"use client";

import Link from "next/link";
import { useState } from "react";
import { registerAction } from "@/server/auth/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio, Select } from "@/components/ui/input";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";
import { FAMILY_LOCATION_LABELS } from "@/lib/labels";

type RoleChoice = "FAMILLE" | "ACCOMPAGNANT";

export function RegisterForm({ defaultRole, next }: { defaultRole: RoleChoice; next?: string }) {
  // Hook du socle : la saisie reste en place après une erreur (pas de remise à zéro par React 19).
  const { state, onSubmit, pending } = useFormAction(registerAction, initialActionState);
  const [role, setRole] = useState<RoleChoice>(defaultRole);
  const fe = !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField label="Code testeur" htmlFor="testerCode" hint="Koudmen est en test sur invitation. Saisissez le code reçu." errors={fe?.testerCode} required>
        <Input {...fieldA11y("testerCode", fe?.testerCode, true)} autoComplete="off" autoCapitalize="characters" required />
      </FormField>
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
      <Checkbox
        id="acceptCgu"
        name="acceptCgu"
        label={
          <>
            J&apos;accepte les{" "}
            <Link href="/cgu-test" target="_blank" className="font-semibold text-mer underline">
              conditions d&apos;utilisation du test
            </Link>
            .
          </>
        }
        required
      />
      {fe?.acceptCgu ? (
        <p className="text-sm font-semibold text-hibiscus" role="alert">
          {fe.acceptCgu.join(" ")}
        </p>
      ) : null}
      <Checkbox id="adult" name="adult" label="J'ai 18 ans ou plus." required />
      {fe?.adult ? (
        <p className="text-sm font-semibold text-hibiscus" role="alert">
          {fe.adult.join(" ")}
        </p>
      ) : null}
      <FormMessage state={state} />
      <PendingButton pending={pending} pendingLabel="Création…">
        Créer mon compte
      </PendingButton>
    </form>
  );
}
