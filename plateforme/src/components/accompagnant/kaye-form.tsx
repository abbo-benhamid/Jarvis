"use client";

import { useState } from "react";
import type { Appetite } from "@prisma/client";
import { createKayeAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { ACTIVITY_SUGGESTIONS, APPETITE_LABELS, MOOD_LABELS } from "@/lib/labels";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/cn";
import { MOOD_ICONS } from "./kaye-view";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

const APPETITES: Appetite[] = ["BON", "MOYEN", "FAIBLE", "NON_OBSERVE"];

const TILE =
  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-line bg-surface p-2 text-center font-semibold " +
  "has-[:checked]:border-mer has-[:checked]:bg-mer-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]";

/**
 * Kayé en moins de 2 minutes : 2 choix obligatoires (humeur, appétit), le reste facultatif.
 * Non médical (RM-13) : pas de diagnostic, pas de médicament.
 */
export function KayeForm({ visitId, aineFirstName }: { visitId: string; aineFirstName: string }) {
  const { state, onSubmit, pending } = useFormAction(createKayeAction, initialActionState);
  const [mood, setMood] = useState<number | null>(null);
  const [appetite, setAppetite] = useState<Appetite | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [alert, setAlert] = useState(false);
  const [alertNote, setAlertNote] = useState("");
  const fe = !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="visitId" value={visitId} />
      <Alert tone="info">Le Kayé raconte la visite. Pas de diagnostic, pas de médicament.</Alert>

      <Fieldset legend={<span className="text-xl font-bold">Humeur de {aineFirstName}</span>} errors={fe?.mood}>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((m) => {
            const Icon = MOOD_ICONS[m as keyof typeof MOOD_ICONS];
            return (
              <label key={m} htmlFor={`mood-${m}`} className={cn(TILE, "min-h-24")}>
                <input
                  id={`mood-${m}`}
                  type="radio"
                  name="mood"
                  value={m}
                  checked={mood === m}
                  onChange={() => setMood(m)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className="size-9 text-mer" />
                <span className="text-sm leading-tight">{MOOD_LABELS[m]}</span>
              </label>
            );
          })}
        </div>
      </Fieldset>

      <Fieldset legend={<span className="text-xl font-bold">Appétit</span>} errors={fe?.appetite}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {APPETITES.map((a) => (
            <label key={a} htmlFor={`appetite-${a}`} className={cn(TILE, "min-h-14")}>
              <input
                id={`appetite-${a}`}
                type="radio"
                name="appetite"
                value={a}
                checked={appetite === a}
                onChange={() => setAppetite(a)}
                className="sr-only"
              />
              {APPETITE_LABELS[a]}
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset
        legend={<span className="text-xl font-bold">Activités</span>}
        hint="Touchez une ou plusieurs activités (facultatif)."
        errors={fe?.activities}
      >
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_SUGGESTIONS.map((a) => (
            <label
              key={a}
              htmlFor={`act-${a}`}
              className="flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line bg-surface px-4 font-semibold has-[:checked]:border-mer has-[:checked]:bg-mer-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]"
            >
              <input
                id={`act-${a}`}
                type="checkbox"
                name="activities"
                value={a}
                checked={activities.includes(a)}
                onChange={(e) => setActivities((s) => (e.target.checked ? [...s, a] : s.filter((x) => x !== a)))}
                className="sr-only"
              />
              {activities.includes(a) ? <span aria-hidden="true">✓&nbsp;</span> : null}
              {a}
            </label>
          ))}
        </div>
        <FormField label="Autre activité (facultatif)" htmlFor="otherActivity" errors={fe?.otherActivity} className="mt-2">
          <Input
            {...fieldA11y("otherActivity", fe?.otherActivity)}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={40}
          />
        </FormField>
      </Fieldset>

      <FormField
        label={<span className="text-xl font-bold">Note (facultatif)</span>}
        htmlFor="note"
        hint={`Une ou deux phrases pour la famille. ${500 - note.length} caractères restants.`}
        errors={fe?.note}
      >
        <Textarea {...fieldA11y("note", fe?.note, true)} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
      </FormField>

      <div className={cn("flex flex-col gap-2 rounded-xl border-2 p-4", alert ? "border-soleil bg-soleil-soft" : "border-line")}>
        <Checkbox
          id="alertFlag"
          name="alertFlag"
          checked={alert}
          onChange={(e) => setAlert(e.target.checked)}
          label={<span className="text-lg font-bold">Signaler un point à surveiller</span>}
        />
        <p className="text-sm text-muted">
          Ce n&apos;est pas une alerte médicale. La famille reçoit un message. En cas d&apos;urgence, appelez le 15.
        </p>
        {alert ? (
          <FormField label="Que faut-il surveiller ?" htmlFor="alertNote" errors={fe?.alertNote} required>
            <Textarea
              {...fieldA11y("alertNote", fe?.alertNote)}
              value={alertNote}
              onChange={(e) => setAlertNote(e.target.value)}
              rows={2}
              maxLength={300}
              aria-required="true"
            />
          </FormField>
        ) : null}
      </div>

      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" pendingLabel="Envoi…" className="w-full">
        Envoyer le Kayé
      </PendingButton>
    </form>
  );
}
