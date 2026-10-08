"use client";

import { useState } from "react";
import { decideVisitReviewAction } from "@/server/presence/actions";
import { initialActionState } from "@/lib/action-result";
import { proofCountLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";

type Decision = "CONFIRMER" | "SIGNALER";

/**
 * L1-B (R7) : la famille employeur tranche une visite « À vérifier ».
 * L1d (M7) :
 * - question neutre, sans faute d'accord : « La visite de Josiane a-t-elle eu lieu chez Léonie ? » ;
 * - nombre exact de preuves (« 0 preuve sur 3. Il en faut 2. ») ;
 * - un geste de confirmation avant l'envoi (« Confirmer » ou « Annuler ») ;
 * - après « je signale un problème », la trace reste visible au rechargement (« Signalé le … »).
 */
export function VisitReviewForm({
  visitId,
  firstName,
  caregiver,
  valid,
  reportedOn = null,
}: {
  visitId: string;
  firstName: string;
  caregiver: string;
  /** Nombre de preuves valides (0 à 3). */
  valid: number;
  /** Date du signalement déjà envoyé, sinon null. */
  reportedOn?: string | null;
}) {
  const { state, onSubmit, pending } = useFormAction(decideVisitReviewAction, initialActionState);
  const [choice, setChoice] = useState<Decision | null>(null);

  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-md bg-feuille-soft p-3.5 text-[15px] leading-[1.45]">
        {state.message}
      </p>
    );
  }
  if (reportedOn) {
    return (
      <p className="rounded-md bg-soleil-soft p-3.5 text-[15px] leading-[1.45]">
        <strong>Problème signalé le {reportedOn}.</strong> L&apos;équipe Koudmen vous appelle.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md bg-soleil-soft p-3.5" aria-label={`Vérifier la visite chez ${firstName}`}>
      <FormMessage state={state} />
      <input type="hidden" name="visitId" value={visitId} />
      <p className="text-[15px] leading-[1.45]">
        <strong>À vérifier.</strong> {proofCountLabel(valid)}. Il en faut 2. Vous êtes l&apos;employeur : la visite de {caregiver} a-t-elle eu lieu chez{" "}
        {firstName} ?
      </p>
      {choice ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Confirmer votre réponse">
          <p className="text-[15px] font-semibold">
            {choice === "CONFIRMER" ? `Vous confirmez : la visite de ${caregiver} a eu lieu.` : "Vous signalez un problème. L'équipe Koudmen vous appelle."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" name="decision" value={choice} size="lg" disabled={pending} aria-busy={pending}>
              {pending ? "Envoi…" : "Confirmer"}
            </Button>
            <Button variant="quiet" size="lg" onClick={() => setChoice(null)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => setChoice("CONFIRMER")}>
            Oui, la visite a eu lieu
          </Button>
          <Button variant="quiet" size="lg" onClick={() => setChoice("SIGNALER")}>
            Non, je signale un problème
          </Button>
        </div>
      )}
    </form>
  );
}
