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
import { COMMUNES } from "@/lib/communes";

type RoleChoice = "FAMILLE" | "ACCOMPAGNANT";

/**
 * L2 / R6 : création de compte, famille ou accompagnant.
 * - CGU : case obligatoire. Confidentialité : lien à lire (pas une case de consentement, J25).
 * - E-mails d'information : case facultative et séparée.
 * - Accompagnant : téléphone, commune, date de naissance (18 ans minimum). Inscription gratuite.
 */
export function RegisterForm({ defaultRole, next }: { defaultRole: RoleChoice; next?: string }) {
  // Hook du socle : la saisie reste en place après une erreur (pas de remise à zéro par React 19).
  const { state, onSubmit, pending } = useFormAction(registerAction, initialActionState);
  const [role, setRole] = useState<RoleChoice>(defaultRole);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const fieldError = (k: string) =>
    fe?.[k] ? (
      <p className="text-sm font-semibold text-hibiscus" role="alert">
        {fe[k]!.join(" ")}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <Fieldset legend="Je crée un compte…" errors={fe?.role}>
        <Radio
          id="role-famille"
          className="rounded-field border-[1.5px] border-line-strong bg-surface px-4 py-3 has-[:checked]:border-mer has-[:checked]:bg-mer-soft"
          name="role"
          value="FAMILLE"
          checked={role === "FAMILLE"}
          onChange={() => setRole("FAMILLE")}
          label={<><strong>Famille</strong> — je veille sur un parent âgé.</>}
        />
        <Radio
          id="role-accompagnant"
          className="rounded-field border-[1.5px] border-line-strong bg-surface px-4 py-3 has-[:checked]:border-mer has-[:checked]:bg-mer-soft"
          name="role"
          value="ACCOMPAGNANT"
          checked={role === "ACCOMPAGNANT"}
          onChange={() => setRole("ACCOMPAGNANT")}
          label={<><strong>Accompagnant</strong> — je veux accompagner des aînés. C&apos;est gratuit pour moi.</>}
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
      <FormField label="Adresse e-mail" htmlFor="email" errors={fe?.email} required>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </FormField>
      <FormField
        label={role === "ACCOMPAGNANT" ? "Téléphone" : "Téléphone (facultatif)"}
        htmlFor="phone"
        hint="L'équipe Koudmen vous appelle à ce numéro."
        errors={fe?.phone}
        required={role === "ACCOMPAGNANT"}
      >
        <Input {...fieldA11y("phone", fe?.phone, true)} type="tel" autoComplete="tel" inputMode="tel" required={role === "ACCOMPAGNANT"} />
      </FormField>
      <FormField label="Mot de passe" htmlFor="password" hint="10 caractères minimum. Évitez un mot de passe courant." errors={fe?.password} required>
        <Input {...fieldA11y("password", fe?.password, true)} type="password" autoComplete="new-password" minLength={10} required />
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Ma commune" htmlFor="commune" errors={fe?.commune} required>
            <Select {...fieldA11y("commune", fe?.commune)} defaultValue="" required>
              <option value="" disabled>
                Choisir…
              </option>
              {COMMUNES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date de naissance" htmlFor="birthDate" hint="18 ans minimum." errors={fe?.birthDate} required>
            <Input {...fieldA11y("birthDate", fe?.birthDate, true)} type="date" autoComplete="bday" required />
          </FormField>
        </div>
      )}
      <Checkbox
        id="acceptCgu"
        name="acceptCgu"
        label={
          <>
            J&apos;accepte les{" "}
            <Link href="/cgu" target="_blank" className="font-semibold text-mer underline">
              conditions d&apos;utilisation
            </Link>
            {role === "ACCOMPAGNANT" ? (
              <>
                {" "}et les{" "}
                <Link href="/conditions-accompagnants" target="_blank" className="font-semibold text-mer underline">
                  conditions des accompagnants
                </Link>
              </>
            ) : null}
            .
          </>
        }
        required
      />
      {fieldError("acceptCgu")}
      {role === "FAMILLE" ? (
        <>
          <Checkbox id="adult" name="adult" label="J'ai 18 ans ou plus." required />
          {fieldError("adult")}
        </>
      ) : null}
      <Checkbox id="newsOptIn" name="newsOptIn" label="Je veux recevoir les nouvelles de Koudmen par e-mail (facultatif)." />
      <p className="text-[15px] text-muted">
        Pour savoir ce que Koudmen fait de vos données, lisez la{" "}
        <Link href="/confidentialite" target="_blank" className="font-semibold text-mer underline">
          politique de confidentialité
        </Link>
        .
      </p>
      <PendingButton pending={pending} size="lg" className="w-full" pendingLabel="Création…">
        Créer mon compte
      </PendingButton>
    </form>
  );
}
