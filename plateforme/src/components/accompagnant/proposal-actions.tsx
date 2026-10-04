"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { acceptProposalAction, declineProposalAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { PendingButton, useFormAction } from "./use-form-action";
import { FormMessage } from "@/components/ui/form-message";

/** Accepter / Refuser une proposition. Le refus est libre, sans motif obligatoire, sans pénalité. */
export function ProposalActions({
  proposalId,
  plannedVisits,
  canAccept,
}: {
  proposalId: string;
  plannedVisits: number;
  canAccept: boolean;
}) {
  const [acceptState, accept] = useActionState(acceptProposalAction, initialActionState);
  const { state: declineState, onSubmit: onDecline, pending: declinePending } = useFormAction(declineProposalAction, initialActionState);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const fe = !declineState.ok ? declineState.fieldErrors : undefined;
  const noteId = `declineNote-${proposalId}`;

  useEffect(() => {
    if (declining) noteRef.current?.focus();
  }, [declining]);

  if (declining) {
    return (
      <form onSubmit={onDecline} className="flex flex-col gap-3 rounded-xl border-2 border-line p-4">
        <input type="hidden" name="proposalId" value={proposalId} />
        <p className="font-bold">Refuser cette proposition</p>
        <p>Votre refus n&apos;a aucun effet sur votre profil ni sur vos prochaines propositions.</p>
        <FormField
          label="Un mot pour l'équipe Koudmen (facultatif)"
          htmlFor={noteId}
          hint="Vous n'avez pas à vous justifier. La famille ne lit pas ce message."
          errors={fe?.declineNote}
        >
          <Textarea
            ref={noteRef}
            {...fieldA11y(noteId, fe?.declineNote, true)}
            name="declineNote"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
        <FormMessage state={declineState} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <PendingButton pending={declinePending} variant="danger" size="lg" pendingLabel="Envoi…">
            Confirmer le refus
          </PendingButton>
          <Button variant="secondary" size="lg" onClick={() => setDeclining(false)}>
            Revenir
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormMessage state={acceptState} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {canAccept ? (
          <form action={accept} className="flex flex-col">
            <input type="hidden" name="proposalId" value={proposalId} />
            <SubmitButton size="lg" pendingLabel="Acceptation…">
              Accepter
            </SubmitButton>
          </form>
        ) : null}
        <Button variant="secondary" size="lg" onClick={() => setDeclining(true)}>
          Refuser
        </Button>
      </div>
      {canAccept ? (
        <p className="text-sm text-muted">
          Si vous acceptez, Koudmen planifie {plannedVisits} visite{plannedVisits > 1 ? "s" : ""} sur les 4 prochaines semaines.
        </p>
      ) : null}
    </div>
  );
}
