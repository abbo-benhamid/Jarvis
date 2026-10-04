"use client";

import { useState } from "react";
import { createRequestAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { DAY_LABELS, EMPLOYER_TYPE_LABELS, FREQUENCY_LABELS, LEVEL_DESCRIPTIONS, LEVEL_LABELS, SLOT_LABELS } from "@/lib/labels";
import { DURATION_OPTIONS, FREQUENCY_VALUES, SLOT_VALUES } from "@/server/famille/schemas";
import { durationLabel } from "@/server/famille/logic";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Input, Radio, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

export type RequestAineOption = { id: string; firstName: string; lastInitial: string | null; activityLevel: number; communeLabel: string };

/** F6 : demande d'accompagnement. Le niveau est pré-rempli par le niveau d'activité de l'aîné. */
export function RequestForm({ aines, defaultAineId, today }: { aines: RequestAineOption[]; defaultAineId?: string; today: string }) {
  const { state, onSubmit, pending } = useFormAction(createRequestAction, initialActionState);
  const initialAine = aines.find((a) => a.id === defaultAineId) ?? aines[0];
  const [aineId, setAineId] = useState(initialAine?.id ?? "");
  const [level, setLevel] = useState(initialAine?.activityLevel ?? 1);
  const [employerType, setEmployerType] = useState<"AINE" | "REPRESENTANT">("AINE");
  const fe = !state.ok ? state.fieldErrors : undefined;
  const aine = aines.find((a) => a.id === aineId);

  function onAineChange(id: string) {
    setAineId(id);
    const a = aines.find((x) => x.id === id);
    if (a) setLevel(a.activityLevel);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">1. Pour qui ?</h2>
        {aines.length === 1 ? (
          <>
            <input type="hidden" name="aineId" value={aineId} />
            <p>
              <strong>
                {aine?.firstName} {aine?.lastInitial ?? ""}
              </strong>{" "}
              · {aine?.communeLabel}
            </p>
          </>
        ) : (
          <FormField label="Aîné" htmlFor="aineId" errors={fe?.aineId} required>
            <Select {...fieldA11y("aineId", fe?.aineId)} value={aineId} onChange={(e) => onAineChange(e.target.value)} required>
              {aines.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastInitial ?? ""} — {a.communeLabel}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <Fieldset legend="Niveau d'accompagnement" hint="Pré-rempli avec le niveau du profil. Vous pouvez le changer." errors={fe?.level}>
          {[1, 2, 3, 4].map((l) => (
            <Radio
              key={l}
              id={`level-${l}`}
              name="level"
              value={String(l)}
              checked={level === l}
              onChange={() => setLevel(l)}
              label={
                <>
                  <strong>{LEVEL_LABELS[l]}</strong>
                  <span className="block text-sm text-muted">{LEVEL_DESCRIPTIONS[l]}</span>
                </>
              }
            />
          ))}
        </Fieldset>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">2. Quand ?</h2>
        <Fieldset legend="Fréquence" errors={fe?.frequency}>
          <div className="grid sm:grid-cols-2">
            {FREQUENCY_VALUES.map((f) => (
              <Radio key={f} id={`freq-${f}`} name="frequency" value={f} defaultChecked={f === "HEBDOMADAIRE"} label={FREQUENCY_LABELS[f]} />
            ))}
          </div>
        </Fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Créneaux possibles (facultatif)</legend>
          <p id="slots-hint" className="text-sm text-muted">
            Cochez les moments qui conviennent. Plus vous en cochez, plus Koudmen trouve vite un accompagnant.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" aria-describedby="slots-hint">
              <thead>
                <tr>
                  <th scope="col" className="py-1 pr-2 text-sm font-semibold text-muted">
                    <span className="sr-only">Jour</span>
                  </th>
                  {SLOT_VALUES.map((s) => (
                    <th key={s} scope="col" className="px-1 py-1 text-center text-sm font-semibold">
                      {SLOT_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((day, d) => (
                  <tr key={day} className="border-t border-line">
                    <th scope="row" className="py-1 pr-2 font-semibold">
                      {day}
                    </th>
                    {SLOT_VALUES.map((s) => (
                      <td key={s} className="px-1 text-center">
                        <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-mer-soft">
                          <input type="checkbox" name="slots" value={`${d}-${s}`} className="size-5 accent-[var(--mer)]" aria-label={`${day}, ${SLOT_LABELS[s].toLowerCase()}`} />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fe?.slots ? (
            <p role="alert" className="text-sm font-semibold text-hibiscus">
              {fe.slots.join(" ")}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Durée de chaque visite" htmlFor="durationMinutes" errors={fe?.durationMinutes} required>
            <Select {...fieldA11y("durationMinutes", fe?.durationMinutes)} defaultValue="120">
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="À partir du (facultatif)" htmlFor="startDate" errors={fe?.startDate}>
            <Input {...fieldA11y("startDate", fe?.startDate)} type="date" min={today} />
          </FormField>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">3. Un mot pour l&apos;accompagnant (facultatif)</h2>
        <Alert tone="info">Pas d&apos;information médicale : pas de diagnostic, pas de traitement, pas de médicament.</Alert>
        <FormField label="Notes" htmlFor="notes" hint="Exemple : elle aime parler du carnaval, il a un petit chien." errors={fe?.notes}>
          <Textarea {...fieldA11y("notes", fe?.notes, true)} maxLength={500} />
        </FormField>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">4. Qui emploie l&apos;accompagnant ?</h2>
        <p className="text-sm text-muted">
          Koudmen met en relation. Koudmen n&apos;est pas l&apos;employeur. L&apos;employeur (ou le client d&apos;un auto-entrepreneur) est
          l&apos;aîné ou son représentant.
        </p>
        <Fieldset legend="L'employeur est…" errors={fe?.employerType}>
          {(["AINE", "REPRESENTANT"] as const).map((t) => (
            <Radio
              key={t}
              id={`employer-${t}`}
              name="employerType"
              value={t}
              checked={employerType === t}
              onChange={() => setEmployerType(t)}
              label={EMPLOYER_TYPE_LABELS[t]}
            />
          ))}
        </Fieldset>
        <FormField
          label="Nom de l'employeur (fictif)"
          htmlFor="employerName"
          hint={employerType === "AINE" ? "Exemple : le nom de l'aîné." : "Exemple : votre nom, si vous êtes le représentant."}
          errors={fe?.employerName}
        >
          <Input {...fieldA11y("employerName", fe?.employerName, true)} maxLength={120} autoComplete="off" />
        </FormField>
        {employerType === "REPRESENTANT" ? (
          <Alert tone="attention">
            Un enfant employeur a droit au crédit d&apos;impôt seulement dans certains cas (par exemple si le parent remplit les conditions de
            l&apos;APA). [À VÉRIFIER] avec un conseiller avant toute vraie embauche.
          </Alert>
        ) : null}
        <Alert tone="info">
          Koudmen ne déclare pas à votre place. Koudmen vous donne un relevé d&apos;heures. Vous déclarez vous-même sur cesu.urssaf.fr.
        </Alert>
      </Card>

      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" pendingLabel="Envoi de la demande…" className="sm:self-start">
        Envoyer la demande
      </PendingButton>
    </form>
  );
}
