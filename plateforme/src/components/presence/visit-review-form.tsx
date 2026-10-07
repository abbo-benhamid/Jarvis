"use client";

import { decideVisitReviewAction } from "@/server/presence/actions";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";

/**
 * L1-B (R7) : la famille employeur tranche une visite « À vérifier ».
 * Deux réponses : la visite a eu lieu (confirmation), ou un problème est signalé à l'équipe Koudmen.
 */
export function VisitReviewForm({ visitId, firstName, caregiver }: { visitId: string; firstName: string; caregiver: string }) {
  const { state, onSubmit, pending } = useFormAction(decideVisitReviewAction, initialActionState);
  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-md bg-feuille-soft p-3.5 text-[15px] leading-[1.45]">
        {state.message}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md bg-soleil-soft p-3.5" aria-label={`Trancher la visite chez ${firstName}`}>
      <FormMessage state={state} />
      <input type="hidden" name="visitId" value={visitId} />
      <p className="text-[15px] leading-[1.45]">
        <strong>À vérifier.</strong> Une preuve manque. Vous êtes l&apos;employeur : {caregiver} est-il venu chez {firstName} ?
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" name="decision" value="CONFIRMER" size="lg" disabled={pending} aria-busy={pending}>
          Oui, la visite a eu lieu
        </Button>
        <Button type="submit" name="decision" value="SIGNALER" variant="quiet" size="lg" disabled={pending}>
          Non, je signale un problème
        </Button>
      </div>
    </form>
  );
}
