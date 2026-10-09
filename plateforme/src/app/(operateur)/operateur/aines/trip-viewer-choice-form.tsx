"use client";

import { recordTripViewerChoiceAction } from "@/server/operateur/comptes-actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import type { CircleMember } from "./accord-form";
import { territoire } from "@/lib/territoires";
import { TERRITOIRE_EQUIPE } from "@/lib/rappel";

/**
 * L1d (D11, suite F2) : lors d'un NOUVEL appel, l'aîné change sa personne désignée pour voir le trajet.
 * Le conseiller l'enregistre (`recordTripViewerChoiceAction`). La famille ne change jamais ce choix.
 */
export function TripViewerChoiceForm({ aineId, firstName, members, currentId }: { aineId: string; firstName: string; members: CircleMember[]; currentId: string | null }) {
  const { state, onSubmit, pending } = useFormAction(recordTripViewerChoiceAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const p = (k: string) => `${k}-tv-${aineId}`;
  const payer = members.find((m) => m.isPayer);
  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-md bg-feuille-soft p-3.5 text-[15px] font-semibold">
        {state.message}
      </p>
    );
  }
  return (
    <details className="rounded-md bg-surface-2 p-3">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">Changer la personne désignée (nouvel appel)</summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="aineId" value={aineId} />
        <FormMessage state={state} />
        <FormField label={`Date et heure de l'appel (${territoire(TERRITOIRE_EQUIPE).libelleHeure})`} htmlFor={p("appelLe")} errors={fe?.appelLe} required>
          <Input {...fieldA11y(p("appelLe"), fe?.appelLe)} name="appelLe" type="datetime-local" required />
        </FormField>
        <FormField
          label="Personne désignée par l'aîné pour voir le trajet"
          htmlFor={p("personneDesignee")}
          hint={`Demandez à ${firstName} : « Qui peut voir où est l'accompagnant, quand il vient chez vous ? »`}
          errors={fe?.personneDesignee}
        >
          <Select {...fieldA11y(p("personneDesignee"), fe?.personneDesignee, true)} name="personneDesignee" defaultValue={currentId && members.some((m) => m.userId === currentId && !m.isPayer) ? currentId : "EMPLOYEUR"}>
            <option value="EMPLOYEUR">{payer ? `L'employeur : ${payer.label}` : "L'employeur"}</option>
            {members
              .filter((m) => !m.isPayer)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.label}
                </option>
              ))}
          </Select>
        </FormField>
        <Checkbox id={p("confirm")} name="confirm" label={`${firstName} a fait ce choix au téléphone.`} />
        {fe?.confirm ? (
          <p className="text-sm font-semibold text-hibiscus" role="alert">
            {fe.confirm.join(" ")}
          </p>
        ) : null}
        <div>
          <PendingButton pending={pending} pendingLabel="Enregistrement…">
            Enregistrer le choix
          </PendingButton>
        </div>
      </form>
    </details>
  );
}
