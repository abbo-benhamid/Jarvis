"use client";

import { useState } from "react";
import type { CaregiverStatus } from "@prisma/client";
import { saveProfileAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { COMMUNES } from "@/lib/communes";
import { DAY_LABELS, SLOT_LABELS } from "@/lib/labels";
import { formatEuros } from "@/lib/format";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { ChoiceCard } from "./choice-card";
import { PendingButton, useFormAction } from "./use-form-action";

const SLOTS = ["MATIN", "APRES_MIDI", "SOIR"] as const;

export type ProfileFormValues = {
  communes: string[];
  availabilities: string[];
  hourlyRate: string;
  bio: string;
  associationName: string;
  saadName: string;
  siret: string;
};

export function ProfileForm({
  status,
  initial,
  smicCents,
}: {
  status: CaregiverStatus;
  initial: ProfileFormValues;
  /** Rappel du SMIC si le statut est salarié, sinon null. */
  smicCents: number | null;
}) {
  const { state, onSubmit, pending } = useFormAction(saveProfileAction, initialActionState);
  const [v, setV] = useState(initial);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const paid = status !== "BENEVOLE_ASSO";

  const toggle = (key: "communes" | "availabilities", value: string, on: boolean) =>
    setV((s) => ({ ...s, [key]: on ? [...s[key], value] : s[key].filter((x) => x !== value) }));
  const text = (key: keyof ProfileFormValues) => ({
    value: v[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value })),
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {paid ? (
        <Card className="flex flex-col gap-3">
          <CardTitle>Mon tarif horaire</CardTitle>
          <FormField
            label="Votre tarif, en euros par heure"
            htmlFor="hourlyRate"
            hint="Vous fixez votre tarif librement. Koudmen et la famille ne le modifient pas. La famille le voit avant de choisir."
            errors={fe?.hourlyRate}
          >
            <div className="flex items-center gap-2">
              <Input
                {...fieldA11y("hourlyRate", fe?.hourlyRate, true)}
                {...text("hourlyRate")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="15"
                className="max-w-40 text-2xl font-bold"
              />
              <span className="text-lg font-semibold">€ / heure</span>
            </div>
          </FormField>
          {smicCents != null ? (
            <p className="text-sm text-muted">
              Rappel : vous êtes salarié(e). Votre tarif ne peut pas être sous le SMIC horaire brut (
              {formatEuros(smicCents)} en 2025, montant à confirmer).
            </p>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardTitle>Bénévolat</CardTitle>
          <p>Vous aidez sans être payé(e). Pas de tarif à indiquer.</p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardTitle>Mes communes</CardTitle>
        <Fieldset legend="Communes où vous pouvez aller" hint="Choisissez une ou plusieurs communes." errors={fe?.communes}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {COMMUNES.map((c) => (
              <ChoiceCard
                key={c.code}
                type="checkbox"
                id={`commune-${c.code}`}
                name="communes"
                value={c.code}
                label={c.label}
                checked={v.communes.includes(c.code)}
                onChange={(e) => toggle("communes", c.code, e.target.checked)}
              />
            ))}
          </div>
        </Fieldset>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Mes disponibilités</CardTitle>
        <Fieldset legend="Quand êtes-vous disponible ?" hint="Cochez les créneaux. Vous pouvez les changer à tout moment." errors={fe?.availabilities}>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-left">
              <thead>
                <tr>
                  <th scope="col" className="sr-only">
                    Jour
                  </th>
                  {SLOTS.map((s) => (
                    <th key={s} scope="col" className="px-1 text-center text-sm font-semibold">
                      {SLOT_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((day, d) => (
                  <tr key={day}>
                    <th scope="row" className="pr-2 font-semibold">
                      {day}
                    </th>
                    {SLOTS.map((s) => {
                      const key = `${d}-${s}`;
                      const on = v.availabilities.includes(key);
                      return (
                        <td key={s} className="text-center">
                          <label
                            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border-2 border-line has-[:checked]:border-mer has-[:checked]:bg-mer-soft"
                            htmlFor={`dispo-${key}`}
                          >
                            <input
                              id={`dispo-${key}`}
                              type="checkbox"
                              name="availabilities"
                              value={key}
                              checked={on}
                              onChange={(e) => toggle("availabilities", key, e.target.checked)}
                              className="size-5 accent-[var(--mer)]"
                              aria-label={`${day} ${SLOT_LABELS[s].toLowerCase()}`}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fieldset>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Ma présentation</CardTitle>
        <FormField label="Quelques mots sur vous (facultatif)" htmlFor="bio" hint="600 caractères maximum. La famille lit ce texte." errors={fe?.bio}>
          <Textarea {...fieldA11y("bio", fe?.bio, true)} {...text("bio")} maxLength={600} rows={3} />
        </FormField>
        {status === "BENEVOLE_ASSO" ? (
          <FormField label="Votre association" htmlFor="associationName" errors={fe?.associationName} required>
            <Input {...fieldA11y("associationName", fe?.associationName)} {...text("associationName")} maxLength={120} />
          </FormField>
        ) : null}
        {status === "SAAD" ? (
          <FormField label="Votre SAAD" htmlFor="saadName" errors={fe?.saadName} required>
            <Input {...fieldA11y("saadName", fe?.saadName)} {...text("saadName")} maxLength={120} />
          </FormField>
        ) : null}
        {status === "AUTO_ENTREPRENEUR_SAP" ? (
          <FormField label="Votre SIRET" htmlFor="siret" hint="14 chiffres. Données fictives seulement." errors={fe?.siret} required>
            <Input {...fieldA11y("siret", fe?.siret, true)} {...text("siret")} inputMode="numeric" maxLength={20} />
          </FormField>
        ) : null}
      </Card>

      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" pendingLabel="Enregistrement…">
        Enregistrer mon profil
      </PendingButton>
    </form>
  );
}
