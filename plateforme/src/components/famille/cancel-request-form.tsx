"use client";

import { useActionState, useState } from "react";
import { cancelRequestAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/** F5 : annulation en deux temps (demande de confirmation), pour éviter une erreur de doigt sur mobile. */
export function CancelRequestForm({ requestId, aineFirstName }: { requestId: string; aineFirstName: string }) {
  const [state, action] = useActionState(cancelRequestAction, initialActionState);
  const [asking, setAsking] = useState(false);

  // Succès : l'action redirige vers /famille/demandes?annulee=1 (message en haut de page).
  return (
    <div className="flex flex-col gap-2">
      {!asking ? (
        <Button variant="link" onClick={() => setAsking(true)} className="self-start px-0">
          Annuler la demande
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-2 rounded-md bg-surface-2 p-4">
          <input type="hidden" name="requestId" value={requestId} />
          <p className="font-semibold">Annuler la demande pour {aineFirstName} ?</p>
          <p className="text-sm text-muted">Les propositions en attente seront annulées aussi.</p>
          <div className="flex flex-col gap-1">
            <SubmitButton variant="danger" size="lg" pendingLabel="Annulation…" className="w-full">
              Oui, annuler
            </SubmitButton>
            <Button variant="link" onClick={() => setAsking(false)} className="w-full">
              Non, garder
            </Button>
          </div>
        </form>
      )}
      <FormMessage state={state} />
    </div>
  );
}
