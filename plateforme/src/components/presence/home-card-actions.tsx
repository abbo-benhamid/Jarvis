"use client";

import { Printer, RefreshCw } from "lucide-react";
import { regenerateHomeCardAction } from "@/server/presence/actions";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** Boutons de la carte domicile : imprimer, et (gestionnaire ou opérateur) créer une nouvelle carte. */
export function HomeCardActions({ aineId, firstName, canRegenerate }: { aineId: string; firstName: string; canRegenerate: boolean }) {
  const { state, onSubmit, pending } = useFormAction(regenerateHomeCardAction, initialActionState);
  return (
    <div className="flex flex-col gap-4">
      <Button type="button" size="lg" fullWidth icon={<Printer strokeWidth={1.6} />} onClick={() => window.print()}>
        Imprimer la carte
      </Button>
      {canRegenerate ? (
        <Card className="flex flex-col gap-3">
          <h2 className="inline-flex items-center gap-2 font-sans text-[17px] font-semibold tracking-normal">
            <RefreshCw aria-hidden="true" className="size-[18px] text-mer" strokeWidth={1.6} />
            Carte perdue ou volée ?
          </h2>
          <p className="text-[15px] leading-[1.45] text-muted">
            Créez une nouvelle carte. L&apos;ancienne carte (QR code et code de secours) ne marchera plus. Imprimez la nouvelle carte et
            remplacez-la chez {firstName}.
          </p>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <FormMessage state={state} />
            <input type="hidden" name="aineId" value={aineId} />
            <div className="rounded-md bg-surface-2 px-3">
              <Checkbox id="confirm-regenerate" name="confirm" value="oui" label="Je comprends : l'ancienne carte ne marchera plus." />
            </div>
            <PendingButton pending={pending} variant="quiet" size="lg" pendingLabel="Création…" className="w-full">
              Créer une nouvelle carte
            </PendingButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
