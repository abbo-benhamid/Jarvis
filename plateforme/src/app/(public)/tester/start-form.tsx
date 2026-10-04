"use client";

import Link from "next/link";
import { useState } from "react";
import { startSandboxAction } from "@/server/sandbox/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** Formulaire d'entrée du test : code, rôle joué, CGU de test, âge, données fictives (D3, D4). */
export function StartSandboxForm({ defaultCode }: { defaultCode: string }) {
  const { state, onSubmit, pending } = useFormAction(startSandboxAction, initialActionState);
  const [role, setRole] = useState<"FAMILLE" | "ACCOMPAGNANT">("FAMILLE");
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormField label="Code testeur" htmlFor="testerCode" hint="Le code reçu avec votre invitation." errors={fe?.testerCode} required>
        <Input {...fieldA11y("testerCode", fe?.testerCode, true)} defaultValue={defaultCode} autoComplete="off" autoCapitalize="characters" required />
      </FormField>
      <Fieldset legend="Quel rôle voulez-vous jouer ?" errors={fe?.role}>
        <Radio
          id="role-famille"
          name="role"
          value="FAMILLE"
          checked={role === "FAMILLE"}
          onChange={() => setRole("FAMILLE")}
          label={
            <>
              <strong>Famille</strong> — je veille sur un parent âgé, de près ou de loin.
            </>
          }
        />
        <Radio
          id="role-accompagnant"
          name="role"
          value="ACCOMPAGNANT"
          checked={role === "ACCOMPAGNANT"}
          onChange={() => setRole("ACCOMPAGNANT")}
          label={
            <>
              <strong>Accompagnant</strong> — je veux accompagner des aînés près de chez moi.
            </>
          }
        />
      </Fieldset>
      <FormField label="Votre prénom dans le test (facultatif)" htmlFor="firstName" hint="Un prénom inventé convient très bien." errors={fe?.firstName}>
        <Input {...fieldA11y("firstName", fe?.firstName, true)} maxLength={40} autoComplete="off" />
      </FormField>
      <div className="flex flex-col gap-3">
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
        {fe?.acceptCgu ? <p className="text-sm font-semibold text-hibiscus">{fe.acceptCgu.join(" ")}</p> : null}
        <Checkbox id="adult" name="adult" label="J'ai 18 ans ou plus." required />
        {fe?.adult ? <p className="text-sm font-semibold text-hibiscus">{fe.adult.join(" ")}</p> : null}
        <Checkbox
          id="acceptTest"
          name="acceptTest"
          label="J'utilise uniquement des données fictives : pas de vrai nom d'aîné, pas d'information de santé."
          required
        />
        {fe?.acceptTest ? <p className="text-sm font-semibold text-hibiscus">{fe.acceptTest.join(" ")}</p> : null}
      </div>
      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" pendingLabel="Création de votre bac à sable…">
        Commencer le test
      </PendingButton>
    </form>
  );
}
