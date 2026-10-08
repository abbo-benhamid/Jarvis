"use client";

import { useState, type FormEvent } from "react";
import { recordAccordL1dAction } from "@/server/operateur/accord-l1d-actions";
import { initialActionState } from "@/lib/action-result";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

export type CircleMember = { userId: string; label: string; isPayer: boolean };

const SUMMARY: Record<string, (p: string) => string> = {
  ACCORD: (p) => `${p} dit OUI.`,
  REFUS: (p) => `${p} dit NON.`,
  RAPPELER: (p) => `${p} veut en parler à quelqu'un. Vous rappelez plus tard.`,
  RETRAIT: (p) => `${p} retire son accord.`,
};

/**
 * R5 (J5), L1d (D14, D11) : réponse de l'aîné après l'appel.
 * - AUCUNE réponse cochée par défaut (B2). Trois réponses : oui, non, rappeler plus tard.
 * - « Qui a répondu » et la mesure de protection sont obligatoires (aucune valeur par défaut).
 * - Personne désignée pour voir le trajet : choisie PAR L'AÎNÉ pendant l'appel. Défaut : l'employeur.
 * - Écran de confirmation avant l'enregistrement : « Vous enregistrez : Odette dit OUI. »
 */
export function AccordForm({
  aineId,
  firstName,
  recueilli,
  situations,
  members,
}: {
  aineId: string;
  firstName: string;
  recueilli: boolean;
  situations: Record<string, string>;
  members: CircleMember[];
}) {
  const { state, onSubmit, pending } = useFormAction(recordAccordL1dAction, initialActionState);
  const [resultat, setResultat] = useState<string>("");
  const [qui, setQui] = useState<"" | "AINE" | "REPRESENTANT">("");
  const [situation, setSituation] = useState("");
  const [review, setReview] = useState<string | null>(null);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const p = (k: string) => `${k}-${aineId}`;
  const payer = members.find((m) => m.isPayer);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    // 1er clic : résumé à confirmer (si une réponse est choisie). 2e clic : envoi.
    if (review === null && resultat) {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const who = fd.get("personneDesignee");
      const viewer = members.find((m) => m.userId === who)?.label ?? (payer ? `${payer.label} (employeur)` : "l'employeur");
      setReview(`${SUMMARY[resultat]!(firstName)}${resultat === "ACCORD" ? ` Personne désignée pour le trajet : ${viewer}.` : ""}`);
      return;
    }
    setReview(null);
    onSubmit(e);
  };

  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-md bg-feuille-soft p-3.5 text-[15px] font-semibold">
        {state.message}
      </p>
    );
  }

  return (
    <details className="rounded-md bg-surface-2 p-3">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">{recueilli ? "Enregistrer un retrait de l'accord" : "Enregistrer la réponse après l'appel"}</summary>
      <form onSubmit={handleSubmit} onChange={() => setReview(null)} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="aineId" value={aineId} />
        <FormMessage state={state} />
        <Fieldset legend={`Réponse de ${firstName}`} errors={fe?.resultat}>
          {recueilli ? (
            <Radio id={p("retrait")} name="resultat" value="RETRAIT" checked={resultat === "RETRAIT"} onChange={() => setResultat("RETRAIT")} label="Retrait de l'accord" />
          ) : (
            <div className="flex flex-col">
              <Radio id={p("accord")} name="resultat" value="ACCORD" checked={resultat === "ACCORD"} onChange={() => setResultat("ACCORD")} label="Oui, d'accord" />
              <Radio id={p("refus")} name="resultat" value="REFUS" checked={resultat === "REFUS"} onChange={() => setResultat("REFUS")} label="Non" />
              <Radio
                id={p("rappeler")}
                name="resultat"
                value="RAPPELER"
                checked={resultat === "RAPPELER"}
                onChange={() => setResultat("RAPPELER")}
                label="Il veut en parler à quelqu'un : rappeler plus tard"
              />
            </div>
          )}
        </Fieldset>
        <FormField label="Date et heure de l'appel (heure de Martinique)" htmlFor={p("appelLe")} errors={fe?.appelLe} required>
          <Input {...fieldA11y(p("appelLe"), fe?.appelLe)} name="appelLe" type="datetime-local" required />
        </FormField>
        <Fieldset legend="Qui a répondu ?" errors={fe?.qui}>
          <div className="flex flex-col">
            <Radio id={p("qui-aine")} name="qui" value="AINE" checked={qui === "AINE"} onChange={() => setQui("AINE")} label={`${firstName}, en personne`} />
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
        {resultat === "RAPPELER" ? null : (
          <FormField label="Mesure de protection juridique" htmlFor={p("situation")} errors={fe?.situationJuridique} required>
            <Select {...fieldA11y(p("situation"), fe?.situationJuridique)} name="situationJuridique" value={situation} onChange={(e) => setSituation(e.target.value)} required>
              <option value="">Choisissez</option>
              {Object.entries(situations).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {situation && situation !== "AUCUNE" && resultat !== "RAPPELER" ? (
          <FormField label="Jugement ou mandat vu le" htmlFor={p("justificatifVuLe")} hint="Aucune copie n'est gardée." errors={fe?.justificatifVuLe} required>
            <Input {...fieldA11y(p("justificatifVuLe"), fe?.justificatifVuLe, true)} name="justificatifVuLe" type="date" required />
          </FormField>
        ) : null}
        {resultat === "ACCORD" ? (
          <FormField
            label="Personne désignée par l'aîné pour voir le trajet"
            htmlFor={p("personneDesignee")}
            hint={`Demandez à ${firstName} : « Qui peut voir où est l'accompagnant, quand il vient chez vous ? » Sans choix : l'employeur.`}
            errors={fe?.personneDesignee}
          >
            <Select {...fieldA11y(p("personneDesignee"), fe?.personneDesignee, true)} name="personneDesignee" defaultValue="EMPLOYEUR">
              <option value="EMPLOYEUR">{payer ? `L'employeur : ${payer.label}` : "L'employeur"}</option>
              {members
                .filter((m) => !m.isPayer)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.label}
                  </option>
                ))}
            </Select>
          </FormField>
        ) : null}
        {resultat === "RAPPELER" ? null : <Checkbox id={p("noticeLue")} name="noticeLue" label="J'ai lu la notice à la personne, mot pour mot." />}
        {fe?.noticeLue ? (
          <p className="text-sm font-semibold text-hibiscus" role="alert">
            {fe.noticeLue.join(" ")}
          </p>
        ) : null}
        {review ? (
          <div role="status" className="flex flex-col gap-2 rounded-md bg-surface p-3.5 shadow-card">
            <p className="text-[17px] font-semibold">Vous enregistrez : {review}</p>
            <PendingButton pending={pending} pendingLabel="Enregistrement…">
              Confirmer l&apos;enregistrement
            </PendingButton>
            <Button variant="link" onClick={() => setReview(null)} disabled={pending}>
              Corriger
            </Button>
          </div>
        ) : (
          <PendingButton pending={pending} pendingLabel="Enregistrement…">
            Vérifier la réponse
          </PendingButton>
        )}
      </form>
    </details>
  );
}
