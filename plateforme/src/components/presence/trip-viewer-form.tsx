"use client";

import { setTripViewerAction } from "@/server/presence/actions";
import { initialActionState } from "@/lib/action-result";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** L1-B (R4) : le payeur choisit la personne désignée qui voit aussi le trajet en direct. */
export function TripViewerForm({
  aineId,
  firstName,
  current,
  members,
}: {
  aineId: string;
  firstName: string;
  current: string | null;
  members: { userId: string; label: string }[];
}) {
  const { state, onSubmit, pending } = useFormAction(setTripViewerAction, initialActionState);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      {state.ok && state.message ? (
        <p role="status" className="text-[15px] text-feuille">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="aineId" value={aineId} />
      <FormField
        label="Personne désignée"
        htmlFor="viewerId"
        hint={`Choisie avec ${firstName}. Elle voit le trajet de l'accompagnant, comme vous. Les autres membres du cercle ne le voient pas.`}
      >
        <Select id="viewerId" name="viewerId" defaultValue={current ?? ""}>
          <option value="">Personne d&apos;autre</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>
      <PendingButton pending={pending} variant="quiet" size="lg" pendingLabel="Enregistrement…" className="w-full">
        Enregistrer
      </PendingButton>
    </form>
  );
}
