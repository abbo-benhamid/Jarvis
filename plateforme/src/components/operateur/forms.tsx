"use client";

import { useActionState, useState } from "react";
import type { FeedbackStatus } from "@prisma/client";
import {
  confirmElderAction,
  decideCaregiverAction,
  proposeCaregiverAction,
  reviewVerificationAction,
  setFeedbackStatusAction,
} from "@/server/operateur/actions";
import {
  DECISION_LABELS,
  decisionNeedsReason,
  REASON_MIN,
  type CaregiverDecision,
} from "@/server/operateur/rules";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Radio, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

/** Décision sur un profil : Valider / Refuser / Suspendre / Réactiver. Motif obligatoire pour refuser ou suspendre. */
export function DecisionForm({ caregiverId, decisions }: { caregiverId: string; decisions: CaregiverDecision[] }) {
  const [state, action] = useActionState(decideCaregiverAction, initialActionState);
  const [choice, setChoice] = useState<CaregiverDecision | null>(decisions.length === 1 ? (decisions[0] ?? null) : null);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const needsReason = choice ? decisionNeedsReason(choice) : false;
  return (
    // noValidate : le serveur valide et affiche un message accessible sous le champ (comme la connexion).
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="caregiverId" value={caregiverId} />
      <Fieldset legend="Votre décision" errors={fe?.decision}>
        {decisions.map((d) => (
          <Radio
            key={d}
            id={`decision-${d}`}
            name="decision"
            value={d}
            label={DECISION_LABELS[d]}
            checked={choice === d}
            onChange={() => setChoice(d)}
          />
        ))}
      </Fieldset>
      <FormField
        label={needsReason ? "Motif (obligatoire)" : "Motif"}
        htmlFor="reason"
        hint={`Obligatoire pour refuser ou suspendre (${REASON_MIN} caractères minimum). L'accompagnant reçoit ce motif. Écrivez des faits, sans jugement.`}
        errors={fe?.reason}
        required={needsReason}
      >
        <Textarea {...fieldA11y("reason", fe?.reason, true)} maxLength={1000} required={needsReason} />
      </FormField>
      <FormMessage state={state} />
      <div>
        <SubmitButton variant={needsReason ? "danger" : "primary"} pendingLabel="Enregistrement…">
          Enregistrer la décision
        </SubmitButton>
      </div>
    </form>
  );
}

/** Revue d'une vérification déclarée (aucune pièce stockée dans le MVP). */
export function VerificationReviewForm({ verificationId }: { verificationId: string }) {
  const [state, action] = useActionState(reviewVerificationAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const id = `note-${verificationId}`;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="verificationId" value={verificationId} />
      <FormField label="Note de revue" htmlFor={id} hint="Obligatoire pour refuser." errors={fe?.note}>
        <Textarea id={id} name="note" rows={2} maxLength={500} aria-describedby={`${id}-hint`} />
      </FormField>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="verdict" value="VALIDE" variant="primary" pendingLabel="Envoi…">
          Valider
        </SubmitButton>
        <SubmitButton name="verdict" value="REFUSE" variant="secondary" pendingLabel="Envoi…">
          Refuser
        </SubmitButton>
      </div>
    </form>
  );
}

/** Bouton « Proposer » d'un candidat compatible. Le serveur revérifie la compatibilité. */
export function ProposeForm({ requestId, caregiverId, name }: { requestId: string; caregiverId: string; name: string }) {
  const [state, action] = useActionState(proposeCaregiverAction, initialActionState);
  const id = `message-${caregiverId}`;
  if (state.ok && state.message) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="caregiverId" value={caregiverId} />
      <details className="rounded-lg border border-line px-3 py-1">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Ajouter un message (facultatif)</summary>
        <FormField label={`Message pour ${name}`} htmlFor={id} hint="Rappel : l'accompagnant est libre d'accepter ou de refuser.">
          <Textarea id={id} name="message" rows={2} maxLength={500} aria-describedby={`${id}-hint`} />
        </FormField>
      </details>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Envoi…">{`Proposer à ${name}`}</SubmitButton>
      </div>
    </form>
  );
}

/** Facteur (c) simulé : « L'aîné a confirmé (appel simulé) ». */
export function ConfirmElderForm({ visitId }: { visitId: string }) {
  const [state, action] = useActionState(confirmElderAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="visitId" value={visitId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="soleil" pendingLabel="Appel simulé…">
          L&apos;aîné a confirmé (appel simulé)
        </SubmitButton>
      </div>
    </form>
  );
}

const FEEDBACK_BUTTONS: { to: FeedbackStatus; label: string }[] = [
  { to: "LU", label: "Marquer comme lu" },
  { to: "TRAITE", label: "Marquer comme traité" },
  { to: "NOUVEAU", label: "Remettre en nouveau" },
];

/** Change le statut d'un retour testeur : NOUVEAU → LU → TRAITE (retour arrière possible). */
export function FeedbackStatusForm({ feedbackId, current }: { feedbackId: string; current: FeedbackStatus }) {
  const [state, action] = useActionState(setFeedbackStatusAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_BUTTONS.filter((b) => b.to !== current).map((b) => (
          <SubmitButton key={b.to} name="status" value={b.to} variant={b.to === "NOUVEAU" ? "ghost" : "secondary"} pendingLabel="Envoi…">
            {b.label}
          </SubmitButton>
        ))}
      </div>
      {!state.ok && state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
