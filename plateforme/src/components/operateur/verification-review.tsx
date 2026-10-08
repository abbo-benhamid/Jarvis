"use client";

import { useState } from "react";
import { cancelDossierRefusalAction, decideAppealAction, decideItemAction } from "@/server/verifications/actions";
import { initialActionState } from "@/lib/action-result";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";
import { FormField, Fieldset } from "@/components/ui/form-field";
import { Checkbox, Radio, Select } from "@/components/ui/input";

/**
 * L2 (étude § 4.4, § 6.5) : décision de l'opérateur sur un élément. Cases et motifs FERMÉS, jamais de texte libre.
 * Un refus est proposé par un opérateur, puis confirmé ou annulé par un AUTRE.
 */
type Option = { code: string; label: string };

function Done({ message }: { message?: string }) {
  return (
    <p role="status" className="rounded-md bg-feuille-soft p-3.5 text-[15px] font-semibold">
      {message}
    </p>
  );
}

export function ItemDecisionForm({
  itemId,
  checklist,
  complements,
  refusals,
  pendingRefusal,
  canConfirm,
  cancelProposed = false,
  cancelProposedByMe = false,
}: {
  itemId: string;
  checklist: readonly Option[];
  complements: readonly Option[];
  refusals: readonly Option[];
  /** Un refus est déjà proposé (motif). */
  pendingRefusal: string | null;
  /** Vrai si cet opérateur n'est pas l'auteur de la proposition. */
  canConfirm: boolean;
  /** L2b (M1) : une annulation du refus est déjà proposée. */
  cancelProposed?: boolean;
  /** L2b (M1) : c'est cet opérateur qui a proposé l'annulation. */
  cancelProposedByMe?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction(decideItemAction, initialActionState);
  const [decision, setDecision] = useState<string>("");
  if (state.ok) return <Done message={state.message} />;
  const options = pendingRefusal
    ? [
        ...(canConfirm ? [["CONFIRMER_REFUS", `Confirmer le refus (${pendingRefusal})`]] : []),
        ...(cancelProposedByMe
          ? []
          : [["ANNULER_REFUS", cancelProposed ? "Confirmer l'annulation du refus (proposée par un autre opérateur)" : "Proposer l'annulation du refus (un autre opérateur confirme)"]]),
      ]
    : [
        ["VALIDE", "Valider"],
        ["COMPLEMENT", "Demander un complément"],
        ["REFUSE", "Proposer un refus (un autre opérateur confirme)"],
      ];
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <FormMessage state={state} />
      {pendingRefusal && !canConfirm ? <p className="text-[15px]">Vous avez proposé ce refus. Un autre opérateur doit le confirmer.</p> : null}
      {cancelProposedByMe ? <p className="text-[15px]">Vous avez proposé d&apos;annuler ce refus. Un autre opérateur doit confirmer l&apos;annulation.</p> : null}
      <Fieldset legend="Votre décision">
        {options.map(([v, l]) => (
          <Radio key={v} id={`d-${v}`} name="decision" value={v} label={l} checked={decision === v} onChange={() => setDecision(v!)} />
        ))}
      </Fieldset>
      {decision === "VALIDE" ? (
        <Fieldset legend="Liste de contrôle (toutes les cases)">
          {checklist.map((c) => (
            <Checkbox key={c.code} id={`case-${c.code}`} name="cases" value={c.code} label={c.label} />
          ))}
        </Fieldset>
      ) : null}
      {decision === "COMPLEMENT" || decision === "REFUSE" ? (
        <FormField label="Motif" htmlFor="motif" hint="Liste fermée. L'accompagnant reçoit un texte simple." required>
          <Select id="motif" name="motif" defaultValue="" aria-describedby="motif-hint">
            <option value="">Choisissez</option>
            {(decision === "COMPLEMENT" ? complements : refusals).map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <div>
        <PendingButton pending={pending} variant={decision === "REFUSE" || decision === "CONFIRMER_REFUS" ? "danger" : "primary"} pendingLabel="Enregistrement…">
          Enregistrer la décision
        </PendingButton>
      </div>
    </form>
  );
}

export function AppealDecisionForm({ appealId }: { appealId: string }) {
  const { state, onSubmit, pending } = useFormAction(decideAppealAction, initialActionState);
  if (state.ok) return <Done message={state.message} />;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="appealId" value={appealId} />
      <FormMessage state={state} />
      <Fieldset legend="Réexamen">
        <Radio id={`ap-ok-${appealId}`} name="outcome" value="ACCEPTE" label="Favorable : rouvrir le dossier (un second opérateur confirme)" />
        <Radio id={`ap-no-${appealId}`} name="outcome" value="MAINTENU" label="Refus maintenu" />
      </Fieldset>
      <div>
        <PendingButton pending={pending} pendingLabel="Enregistrement…">
          Enregistrer
        </PendingButton>
      </div>
    </form>
  );
}

export function CancelRefusalForm({ caregiverId, cancelProposed = false }: { caregiverId: string; cancelProposed?: boolean }) {
  const { state, onSubmit, pending } = useFormAction(cancelDossierRefusalAction, initialActionState);
  if (state.ok) return <Done message={state.message} />;
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="caregiverId" value={caregiverId} />
      <FormMessage state={state} />
      <PendingButton pending={pending} variant="quiet" pendingLabel="Annulation…">
        {cancelProposed ? "Confirmer l'annulation du refus" : "Proposer l'annulation du refus (un autre opérateur confirme)"}
      </PendingButton>
    </form>
  );
}
