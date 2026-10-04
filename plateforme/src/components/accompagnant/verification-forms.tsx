"use client";

import { useActionState, useState } from "react";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import type { VerificationStatus, VerificationType } from "@prisma/client";
import { declareVerificationAction, submitForReviewAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS } from "@/lib/labels";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

const TONE: Record<VerificationStatus, BadgeTone> = {
  A_FOURNIR: "soleil",
  DECLARE: "mer",
  VALIDE: "feuille",
  REFUSE: "hibiscus",
};

const EXAMPLES: Record<VerificationType, string> = {
  IDENTITE: "Exemple : carte d'identité valable jusqu'en 2031.",
  CASIER_B3: "Exemple : extrait B3 demandé le 2 octobre sur casier-judiciaire.justice.gouv.fr.",
  REFERENCES: "Exemple : deux anciens employeurs, coordonnées données à l'équipe.",
  FORMATION: "Exemple : module Koudmen suivi le 3 octobre.",
  STATUT_PRO: "Exemple : SIRET actif, déclaration SAP n° …",
  PSC1: "Exemple : PSC1 obtenu en 2024.",
  DIPLOME: "Exemple : DEAES obtenu en 2019.",
};

export type VerificationRowData = {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  declaration: string | null;
  reviewNote: string | null;
};

export function VerificationRow({ item }: { item: VerificationRowData }) {
  const { state, onSubmit, pending } = useFormAction(declareVerificationAction, initialActionState);
  const [text, setText] = useState(item.declaration ?? "");
  const fe = !state.ok ? state.fieldErrors : undefined;
  const id = `declaration-${item.id}`;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{VERIFICATION_TYPE_LABELS[item.type]}</h2>
        <Badge tone={TONE[item.status]}>{VERIFICATION_STATUS_LABELS[item.status]}</Badge>
      </div>
      {item.status === "REFUSE" && item.reviewNote ? (
        <p className="text-sm">
          <strong>Note de l&apos;équipe :</strong> {item.reviewNote}
        </p>
      ) : null}
      {item.status === "VALIDE" ? (
        <p className="text-muted">L&apos;équipe Koudmen a validé ce point.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="itemId" value={item.id} />
          <FormField label="Votre déclaration" htmlFor={id} hint={EXAMPLES[item.type]} errors={fe?.declaration}>
            <Textarea
              {...fieldA11y(id, fe?.declaration, true)}
              name="declaration"
              rows={2}
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </FormField>
          <FormMessage state={state} />
          <PendingButton pending={pending} variant={item.status === "DECLARE" ? "secondary" : "primary"} pendingLabel="Enregistrement…">
            {item.status === "DECLARE" ? "Modifier ma déclaration" : "J'ai fourni"}
          </PendingButton>
        </form>
      )}
    </Card>
  );
}

export function SubmitReviewForm() {
  const [state, action] = useActionState(submitForReviewAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Envoi…">
        Demander la vérification
      </SubmitButton>
    </form>
  );
}
