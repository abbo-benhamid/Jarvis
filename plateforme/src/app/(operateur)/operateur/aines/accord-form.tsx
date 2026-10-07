"use client";

import { useState } from "react";
import { recordAccordAction } from "@/server/operateur/comptes-actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

/** R5 (J5) : réponse de l'aîné après l'appel (accord, refus, ou retrait d'un accord déjà donné). */
export function AccordForm({ aineId, recueilli, situations }: { aineId: string; recueilli: boolean; situations: Record<string, string> }) {
  const { state, onSubmit, pending } = useFormAction(recordAccordAction, initialActionState);
  const [qui, setQui] = useState<"AINE" | "REPRESENTANT">("AINE");
  const [situation, setSituation] = useState("AUCUNE");
  const fe = !state.ok ? state.fieldErrors : undefined;
  const p = (k: string) => `${k}-${aineId}`;
  return (
    <details className="rounded-md bg-surface-2 p-3">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">{recueilli ? "Enregistrer un retrait de l'accord" : "Enregistrer la réponse après l'appel"}</summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="aineId" value={aineId} />
        <FormMessage state={state} />
        <Fieldset legend="Réponse" errors={fe?.resultat}>
          {recueilli ? (
            <Radio id={p("retrait")} name="resultat" value="RETRAIT" defaultChecked label="Retrait de l'accord" />
          ) : (
            <div className="flex flex-col sm:flex-row sm:gap-6">
              <Radio id={p("accord")} name="resultat" value="ACCORD" defaultChecked label="Oui, d'accord" />
              <Radio id={p("refus")} name="resultat" value="REFUS" label="Non" />
            </div>
          )}
        </Fieldset>
        <FormField label="Date et heure de l'appel (heure de Martinique)" htmlFor={p("appelLe")} errors={fe?.appelLe} required>
          <Input {...fieldA11y(p("appelLe"), fe?.appelLe)} name="appelLe" type="datetime-local" required />
        </FormField>
        <Fieldset legend="Qui a répondu ?" errors={fe?.qui}>
          <div className="flex flex-col sm:flex-row sm:gap-6">
            <Radio id={p("qui-aine")} name="qui" value="AINE" checked={qui === "AINE"} onChange={() => setQui("AINE")} label="L'aîné lui-même" />
            <Radio id={p("qui-rep")} name="qui" value="REPRESENTANT" checked={qui === "REPRESENTANT"} onChange={() => setQui("REPRESENTANT")} label="Son représentant légal" />
          </div>
        </Fieldset>
        {qui === "REPRESENTANT" ? (
          <FormField label="Nom et rôle du représentant" htmlFor={p("nomRepresentant")} hint="Exemple : Patrick B., tuteur." errors={fe?.nomRepresentant} required>
            <Input {...fieldA11y(p("nomRepresentant"), fe?.nomRepresentant, true)} name="nomRepresentant" maxLength={120} required />
          </FormField>
        ) : null}
        <FormField label="Langue de l'appel" htmlFor={p("langue")} errors={fe?.langue} required>
          <Select {...fieldA11y(p("langue"), fe?.langue)} name="langue" defaultValue="FR" required>
            <option value="FR">Français</option>
            <option value="GCF">Créole</option>
          </Select>
        </FormField>
        <FormField label="Mesure de protection juridique" htmlFor={p("situation")} errors={fe?.situationJuridique} required>
          <Select {...fieldA11y(p("situation"), fe?.situationJuridique)} name="situationJuridique" value={situation} onChange={(e) => setSituation(e.target.value)} required>
            {Object.entries(situations).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </FormField>
        {situation !== "AUCUNE" ? (
          <FormField label="Jugement ou mandat vu le" htmlFor={p("justificatifVuLe")} hint="Aucune copie n'est gardée." errors={fe?.justificatifVuLe} required>
            <Input {...fieldA11y(p("justificatifVuLe"), fe?.justificatifVuLe, true)} name="justificatifVuLe" type="date" required />
          </FormField>
        ) : null}
        <Checkbox id={p("noticeLue")} name="noticeLue" label="J'ai lu la notice à la personne, mot pour mot." />
        {fe?.noticeLue ? (
          <p className="text-sm font-semibold text-hibiscus" role="alert">
            {fe.noticeLue.join(" ")}
          </p>
        ) : null}
        <PendingButton pending={pending} pendingLabel="Enregistrement…">
          Enregistrer la réponse
        </PendingButton>
      </form>
    </details>
  );
}
