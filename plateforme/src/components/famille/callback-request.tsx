"use client";

import { useActionState } from "react";
import { PhoneCall } from "lucide-react";
import { requestActivationAction } from "@/server/offre/actions";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

/**
 * L4 / R8 : « Un conseiller m'appelle » pour une formule payante. Aucune commande, aucun paiement (J32).
 * Utilisé sans fiche aîné (préinscription) ou avec un aîné (`aineId`).
 */
export function CallbackRequest({ plan, planName, aineId, pending: alreadyRequested }: { plan: "KOZE" | "SERENITE"; planName: string; aineId?: string; pending?: boolean }) {
  const [state, action, pending] = useActionState(requestActivationAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="plan" value={plan} />
      {aineId ? <input type="hidden" name="aineId" value={aineId} /> : null}
      <FormMessage state={state} />
      {alreadyRequested && !state.ok ? (
        <p className="rounded-md bg-surface-2 p-3 text-[15px] font-semibold">Demande envoyée. Un conseiller Koudmen vous appelle.</p>
      ) : (
        <Button type="submit" variant="quiet" size="lg" fullWidth disabled={pending} aria-busy={pending} icon={<PhoneCall strokeWidth={1.6} />}>
          {pending ? "Envoi…" : `Être appelé pour ${planName}`}
        </Button>
      )}
    </form>
  );
}
