"use client";

import { useState } from "react";
import type { CaregiverStatus } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { saveProfileAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { COMMUNE_ZONES, communeLabel } from "@/lib/communes";
import { DAY_LABELS, SLOT_LABELS } from "@/lib/labels";
import { formatEuros } from "@/lib/format";
import { EXAMPLE_HOURS_PER_VISIT, EXAMPLE_VISITS_PER_MONTH, formatEurosRounded, netIncomeEstimate } from "@/lib/estimates";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { ChoiceCard } from "./choice-card";
import { InstallPrompt } from "./install-prompt";

const SLOTS = ["MATIN", "APRES_MIDI", "SOIR"] as const;
const SLOT_SHORT: Record<(typeof SLOTS)[number], string> = { MATIN: "Matin", APRES_MIDI: "Après-midi", SOIR: "Soir" };

export type ProfileFormValues = {
  communes: string[];
  availabilities: string[];
  hourlyRate: string;
  bio: string;
  associationName: string;
  saadName: string;
  siret: string;
};

/** A3 : tarif (libre, RM-04), revenu estimé, communes, créneaux, présentation. */
export function ProfileForm({
  status,
  initial,
  smicCents,
}: {
  status: CaregiverStatus;
  initial: ProfileFormValues;
  /** Plancher salarié (D10) si le statut est salarié, sinon null. */
  smicCents: number | null;
}) {
  const { state, onSubmit, pending } = useFormAction(saveProfileAction, initialActionState);
  const [v, setV] = useState(initial);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const paid = status !== "BENEVOLE_ASSO";
  const rateCents = Math.round(Number(v.hourlyRate.replace(",", ".").trim()) * 100);
  const net =
    Number.isFinite(rateCents) && rateCents > 0 ? netIncomeEstimate(status, rateCents, EXAMPLE_HOURS_PER_VISIT * 60, EXAMPLE_VISITS_PER_MONTH) : null;

  const toggle = (key: "communes" | "availabilities", value: string, on: boolean) =>
    setV((s) => ({ ...s, [key]: on ? [...s[key], value] : s[key].filter((x) => x !== value) }));
  const text = (key: keyof ProfileFormValues) => ({
    value: v[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [key]: e.target.value })),
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormMessage state={state} />
      {paid ? (
        <Card className="flex flex-col gap-3">
          <CardTitle className="mb-0">Mon tarif</CardTitle>
          <FormField
            label="Votre tarif, en euros par heure"
            htmlFor="hourlyRate"
            hint="Par exemple : 15. Vous fixez votre tarif librement. Koudmen et la famille ne le modifient pas. La famille le voit avant de choisir."
            errors={fe?.hourlyRate}
          >
            <div className="flex items-center gap-3">
              <Input
                {...fieldA11y("hourlyRate", fe?.hourlyRate, true)}
                {...text("hourlyRate")}
                inputMode="decimal"
                autoComplete="off"
                className="num max-w-36 text-[28px] font-semibold"
              />
              <span className="text-[17px] font-semibold text-muted">€ / heure</span>
            </div>
          </FormField>
          {smicCents != null ? (
            <p className="text-sm text-muted">
              Vous êtes salarié(e) : votre tarif est un salaire brut. Minimum légal : {formatEuros(smicCents)} brut de l&apos;heure.
            </p>
          ) : null}
          <NetIncomeBox status={status} net={net} />
        </Card>
      ) : (
        <Card>
          <CardTitle>Bénévolat</CardTitle>
          <p className="text-[15px] text-muted">Vous aidez sans être payé(e). Pas de tarif à indiquer.</p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardTitle className="mb-0">Mes communes</CardTitle>
        <Fieldset legend="Communes où vous pouvez aller" hint="Choisissez une ou plusieurs communes." errors={fe?.communes}>
          {/* m8 : 4 zones repliables au lieu d'une liste plate de 34 communes. */}
          <div className="flex flex-col gap-2">
            {COMMUNE_ZONES.map((z, zi) => {
              const count = z.codes.filter((c) => v.communes.includes(c)).length;
              return (
                <details key={z.label} open={zi === 0 || count > 0} className="group rounded-md bg-surface-2 px-3.5">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                    <span>
                      {z.label}{" "}
                      <span className="font-normal text-muted">
                        {count > 0 ? `(${count} choisie${count > 1 ? "s" : ""})` : `(${z.codes.length} communes)`}
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" strokeWidth={1.6} />
                  </summary>
                  <div className="flex flex-wrap gap-2 pb-3.5">
                    {z.codes.map((code) => (
                      <ChoiceCard
                        key={code}
                        compact
                        type="checkbox"
                        id={`commune-${code}`}
                        name="communes"
                        value={code}
                        label={communeLabel(code)}
                        checked={v.communes.includes(code)}
                        onChange={(e) => toggle("communes", code, e.target.checked)}
                      />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </Fieldset>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle className="mb-0">Mes créneaux</CardTitle>
        <Fieldset legend="Quand êtes-vous disponible ?" hint="Cochez les créneaux. Vous pouvez les changer à tout moment." errors={fe?.availabilities}>
          <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-left">
            <thead>
              <tr>
                <th scope="col" className="w-[30%]">
                  <span className="sr-only">Jour</span>
                </th>
                {SLOTS.map((s) => (
                  <th key={s} scope="col" className="text-center text-[13px] font-semibold text-muted">
                    {SLOT_SHORT[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((day, d) => (
                <tr key={day}>
                  <th scope="row" className="text-[15px] font-semibold">
                    {day}
                  </th>
                  {SLOTS.map((s) => {
                    const key = `${d}-${s}`;
                    const on = v.availabilities.includes(key);
                    return (
                      <td key={s} className="text-center">
                        <label
                          className="flex min-h-11 cursor-pointer items-center justify-center rounded-icon bg-surface shadow-[inset_0_0_0_1.5px_var(--line-strong)] has-[:checked]:bg-mer-soft has-[:checked]:shadow-[inset_0_0_0_2px_var(--mer)] has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid"
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
        </Fieldset>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle className="mb-0">Ma présentation</CardTitle>
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
          <FormField label="Votre SIRET" htmlFor="siret" hint="14 chiffres. Données d'exemple seulement." errors={fe?.siret} required>
            <Input {...fieldA11y("siret", fe?.siret, true)} {...text("siret")} inputMode="numeric" maxLength={20} />
          </FormField>
        ) : null}
      </Card>

      <PendingButton pending={pending} size="xl" pendingLabel="Enregistrement…" className="w-full">
        Enregistrer mon profil
      </PendingButton>
      <InstallPrompt show={state.ok && Boolean(state.message)} />
    </form>
  );
}

/** A4 : revenu net estimé, mis à jour pendant la saisie du tarif. Valeur indicative. */
function NetIncomeBox({ status, net }: { status: CaregiverStatus; net: ReturnType<typeof netIncomeEstimate> }) {
  if (status === "SAAD") {
    return <p className="text-sm text-muted">Votre salaire net est fixé par votre structure.</p>;
  }
  return (
    <div role="status" aria-live="polite" className="rounded-md bg-feuille-soft px-4 py-3.5">
      {net ? (
        <>
          <p className="text-sm font-semibold text-feuille">Revenu net estimé</p>
          <p className="num mt-0.5 text-[17px] font-semibold">environ {formatEuros(net.hourlyCents)} de l&apos;heure</p>
          <p className="mt-1 text-[15px]">
            Pour {EXAMPLE_VISITS_PER_MONTH} visites de {EXAMPLE_HOURS_PER_VISIT} h par mois : environ {formatEurosRounded(net.perMonthCents)} net.
          </p>
          <p className="mt-1 text-sm text-muted">
            Estimation indicative, avant impôt sur le revenu.{" "}
            {status === "AUTO_ENTREPRENEUR_SAP" ? "Cotisations d'auto-entrepreneur déduites." : "Cotisations salariales déduites."}
          </p>
        </>
      ) : (
        <p className="text-[15px]">Écrivez votre tarif : Koudmen affiche votre revenu net estimé.</p>
      )}
    </div>
  );
}
