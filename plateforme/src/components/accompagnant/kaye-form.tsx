"use client";

import { useState } from "react";
import type { Appetite } from "@prisma/client";
import { Check, Send } from "lucide-react";
import { createKayeAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { ACTIVITY_SUGGESTIONS, APPETITE_LABELS, MOOD_LABELS, MOOD_ORDER } from "@/lib/labels";
import { deName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ActionDock } from "@/components/ui/action-dock";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Switch } from "@/components/ui/switch";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { MOOD_ICONS } from "./kaye-view";

const APPETITES: Appetite[] = ["BON", "MOYEN", "FAIBLE", "NON_OBSERVE"];

/** Tuile à choix (radio ou case cachée) : l'état choisi se voit par le bord, le fond ET la coche. */
const TILE =
  "relative flex cursor-pointer items-center justify-center rounded-md bg-surface text-center font-semibold text-fg " +
  "shadow-[inset_0_0_0_1.5px_var(--line-strong)] transition-colors duration-[120ms] " +
  "has-[:checked]:bg-mer-soft has-[:checked]:text-mer has-[:checked]:shadow-[inset_0_0_0_2px_var(--mer)] " +
  "has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid";

const LEGEND = "font-sans text-[17px] leading-[1.3] font-semibold";

/**
 * Kayé en moins de 2 minutes : 2 choix obligatoires (humeur, appétit), le reste facultatif.
 * Non médical (RM-13) : pas de diagnostic, pas de médicament. Envoi au pouce (pied d'action).
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="visitId" value={visitId} />
      <p className="mx-0.5 text-[15px] leading-[1.45] text-muted">
        Le Kayé raconte la visite à la famille. Des faits simples : pas de diagnostic, pas de médicament.
      </p>

      <Card className="flex flex-col gap-5">
        <Fieldset legend={<span className={LEGEND}>Humeur {deName(aineFirstName)}</span>} errors={fe?.mood}>
          <div className="grid grid-cols-5 gap-1.5">
            {MOOD_ORDER.map((m) => {
              const Icon = MOOD_ICONS[m as keyof typeof MOOD_ICONS];
              return (
                <label key={m} htmlFor={`mood-${m}`} className={cn(TILE, "min-h-[84px] flex-col gap-1 px-0.5 py-2")}>
                  <input id={`mood-${m}`} type="radio" name="mood" value={m} checked={mood === m} onChange={() => setMood(m)} className="sr-only" />
                  <Icon aria-hidden="true" className="size-7" strokeWidth={1.6} />
                  <span className="text-[13px] leading-tight">{MOOD_LABELS[m]}</span>
                </label>
              );
            })}
          </div>
        </Fieldset>

        <Fieldset legend={<span className={LEGEND}>Appétit</span>} errors={fe?.appetite}>
          <div className="grid grid-cols-2 gap-2">
            {APPETITES.map((a) => (
              <label key={a} htmlFor={`appetite-${a}`} className={cn(TILE, "min-h-[52px] gap-2 px-3")}>
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
                {appetite === a ? <Check aria-hidden="true" className="size-[18px]" strokeWidth={1.8} /> : null}
              </label>
            ))}
          </div>
        </Fieldset>
      </Card>

      <Card className="flex flex-col gap-4">
        <Fieldset legend={<span className={LEGEND}>Activités</span>} hint="Touchez une ou plusieurs activités (facultatif)." errors={fe?.activities}>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_SUGGESTIONS.map((a) => (
              <label key={a} htmlFor={`act-${a}`} className={cn(TILE, "min-h-11 gap-1.5 rounded-full px-4 text-[15px]")}>
                <input
                  id={`act-${a}`}
                  type="checkbox"
                  name="activities"
                  value={a}
                  checked={activities.includes(a)}
                  onChange={(e) => setActivities((s) => (e.target.checked ? [...s, a] : s.filter((x) => x !== a)))}
                  className="sr-only"
                />
                {activities.includes(a) ? <Check aria-hidden="true" className="size-4" strokeWidth={1.8} /> : null}
                {a}
              </label>
            ))}
          </div>
        </Fieldset>
        <FormField label="Autre activité (facultatif)" htmlFor="otherActivity" errors={fe?.otherActivity}>
          <Input {...fieldA11y("otherActivity", fe?.otherActivity)} value={other} onChange={(e) => setOther(e.target.value)} maxLength={40} />
        </FormField>
        <FormField
          label="Note pour la famille (facultatif)"
          htmlFor="note"
          hint={`Une ou deux phrases. Des faits simples, sans diagnostic. ${500 - note.length} caractères restants.`}
          errors={fe?.note}
        >
          <Textarea
            {...fieldA11y("note", fe?.note, true)}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={`Ex. : « Nous avons joué aux dominos. ${aineFirstName} a gagné deux fois. »`}
          />
        </FormField>
      </Card>

      <Card className={cn("flex flex-col gap-3", alert && "bg-soleil-soft")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p id="alertFlag-label" className="text-[17px] leading-[1.3] font-semibold">
              Signaler un point à surveiller
            </p>
            <p id="alertFlag-hint" className="mt-1 text-sm text-muted">
              Ce n&apos;est pas une alerte médicale. La famille reçoit un message. En cas d&apos;urgence, appelez le 15.
            </p>
          </div>
          <Switch name="alertFlag" checked={alert} onCheckedChange={setAlert} labelledBy="alertFlag-label" describedBy="alertFlag-hint" />
        </div>
        {alert ? (
          <FormField label="Que faut-il surveiller ?" htmlFor="alertNote" errors={fe?.alertNote} required>
            <Textarea
              {...fieldA11y("alertNote", fe?.alertNote)}
              value={alertNote}
              onChange={(e) => setAlertNote(e.target.value)}
              rows={2}
              maxLength={300}
              aria-required="true"
              placeholder="Ex. : « Boit peu. Cheville gauche gonflée. »"
            />
          </FormField>
        ) : null}
      </Card>

      <FormMessage state={state} />

      <ActionDock label="Action principale" hint="La famille le lit tout de suite. Il ne se modifie plus après l'envoi.">
        <PendingButton pending={pending} size="xl" pendingLabel="Envoi…" className="w-full">
          <Send aria-hidden="true" />
          Envoyer le Kayé
        </PendingButton>
      </ActionDock>
    </form>
  );
}
