"use client";

import { useActionState, useState } from "react";
import type { ConsentBy, NeedType } from "@prisma/client";
import { createAineAction, updateAineAction } from "@/server/famille/actions";
import { initialActionState } from "@/lib/action-result";
import { COMMUNES } from "@/lib/communes";
import { LEVEL_DESCRIPTIONS, LEVEL_LABELS, NEED_LABELS } from "@/lib/labels";
import { NEED_VALUES } from "@/server/famille/schemas";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton } from "./pending-button";
import { useKeepForm } from "./use-keep-form";

export type AineFormDefaults = {
  aineId: string;
  firstName: string;
  lastInitial: string | null;
  commune: string;
  addressHint: string | null;
  phone: string | null;
  needs: NeedType[];
  activityLevel: number;
  consentByType: ConsentBy;
  consentByName: string;
};

/** F2 (création) et modification du profil de l'aîné. Garde la saisie en cas d'erreur. */
export function AineForm({ defaults }: { defaults?: AineFormDefaults }) {
  const editing = Boolean(defaults);
  const [state, dispatch, pending] = useActionState(editing ? updateAineAction : createAineAction, initialActionState);
  const onSubmit = useKeepForm(dispatch);
  const [consentBy, setConsentBy] = useState<ConsentBy>(defaults?.consentByType ?? "AINE");
  const fe = !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {defaults ? <input type="hidden" name="aineId" value={defaults.aineId} /> : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">1. Qui est l&apos;aîné ?</h2>
        <p className="text-sm text-muted">Koudmen demande le minimum : le prénom et l&apos;initiale du nom suffisent.</p>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormField label="Prénom" htmlFor="firstName" errors={fe?.firstName} required>
            <Input {...fieldA11y("firstName", fe?.firstName)} defaultValue={defaults?.firstName} autoComplete="off" required maxLength={60} />
          </FormField>
          <FormField label="Initiale du nom" htmlFor="lastInitial" hint="Une lettre." errors={fe?.lastInitial}>
            <Input
              {...fieldA11y("lastInitial", fe?.lastInitial, true)}
              defaultValue={defaults?.lastInitial?.replace(".", "") ?? ""}
              autoComplete="off"
              maxLength={2}
              className="max-w-24"
            />
          </FormField>
        </div>
        {!editing ? (
          <FormField label="Votre lien avec l'aîné" htmlFor="myRelation" hint="Exemple : fille, neveu, voisine." errors={fe?.myRelation} required>
            <Input {...fieldA11y("myRelation", fe?.myRelation, true)} autoComplete="off" required maxLength={60} />
          </FormField>
        ) : null}
        <FormField
          label="Commune"
          htmlFor="commune"
          hint="Koudmen place le domicile au centre de la commune. Aucune adresse exacte n'est demandée."
          errors={fe?.commune}
          required
        >
          <Select {...fieldA11y("commune", fe?.commune, true)} defaultValue={defaults?.commune ?? ""} required>
            <option value="" disabled>
              Choisissez une commune
            </option>
            {COMMUNES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Indication pour trouver la maison (facultatif)" htmlFor="addressHint" hint="Exemple : quartier, couleur du portail. Données fictives en test." errors={fe?.addressHint}>
          <Input {...fieldA11y("addressHint", fe?.addressHint, true)} defaultValue={defaults?.addressHint ?? ""} autoComplete="off" maxLength={160} />
        </FormField>
        <FormField
          label="Téléphone de l'aîné (facultatif)"
          htmlFor="phone"
          hint="Sert à l'appel de confirmation des visites. Numéro fictif en test."
          errors={fe?.phone}
        >
          <Input {...fieldA11y("phone", fe?.phone, true)} defaultValue={defaults?.phone ?? ""} type="tel" inputMode="tel" autoComplete="off" />
        </FormField>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">2. De quoi a-t-il besoin ?</h2>
        <Alert tone="info">N&apos;écrivez aucune information médicale. Koudmen ne demande pas de diagnostic ni de traitement.</Alert>
        <Fieldset legend="Besoins (un ou plusieurs)" errors={fe?.needs}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {NEED_VALUES.map((n) => (
              <Checkbox key={n} id={`need-${n}`} name="needs" value={n} defaultChecked={defaults?.needs.includes(n)} label={NEED_LABELS[n]} />
            ))}
          </div>
        </Fieldset>
        <Fieldset legend="Niveau d'accompagnement souhaité" hint="Vous pourrez le changer pour chaque demande." errors={fe?.activityLevel}>
          {[1, 2, 3, 4].map((l) => (
            <Radio
              key={l}
              id={`level-${l}`}
              name="activityLevel"
              value={String(l)}
              defaultChecked={(defaults?.activityLevel ?? 1) === l}
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
        <h2 className="text-xl font-bold">3. Son accord</h2>
        <p className="text-sm text-muted">
          L&apos;aîné doit être d&apos;accord pour être accompagné. S&apos;il ne peut pas répondre, son représentant (tuteur, mandataire) donne l&apos;accord.
        </p>
        <Fieldset legend="Qui donne son accord ?" errors={fe?.consentByType}>
          <div className="flex flex-col sm:flex-row sm:gap-6">
            <Radio id="consent-aine" name="consentByType" value="AINE" checked={consentBy === "AINE"} onChange={() => setConsentBy("AINE")} label="L'aîné lui-même" />
            <Radio
              id="consent-rep"
              name="consentByType"
              value="REPRESENTANT"
              checked={consentBy === "REPRESENTANT"}
              onChange={() => setConsentBy("REPRESENTANT")}
              label="Son représentant"
            />
          </div>
        </Fieldset>
        <FormField
          label={consentBy === "AINE" ? "Nom et prénom de l'aîné" : "Nom et prénom du représentant, et son rôle"}
          htmlFor="consentByName"
          hint={consentBy === "REPRESENTANT" ? "Exemple : Patrick Bellance (fils, mandataire)." : undefined}
          errors={fe?.consentByName}
          required
        >
          <Input {...fieldA11y("consentByName", fe?.consentByName, consentBy === "REPRESENTANT")} defaultValue={defaults?.consentByName ?? ""} autoComplete="off" required maxLength={120} />
        </FormField>
        <div className="rounded-lg border border-line bg-bg px-3">
          <Checkbox
            id="consentGiven"
            name="consentGiven"
            defaultChecked={editing}
            aria-invalid={fe?.consentGiven ? true : undefined}
            aria-describedby={fe?.consentGiven ? "consentGiven-error" : undefined}
            label={
              <>
                <strong>Je confirme l&apos;accord.</strong> La personne nommée ci-dessus accepte que Koudmen crée ce profil et organise des visites. Elle peut
                retirer son accord à tout moment.
              </>
            }
          />
          {fe?.consentGiven ? (
            <p id="consentGiven-error" role="alert" className="pb-2 text-sm font-semibold text-hibiscus">
              {fe.consentGiven.join(" ")}
            </p>
          ) : null}
        </div>
      </Card>

      <FormMessage state={state} />
      <PendingButton pending={pending} size="lg" pendingLabel="Enregistrement…" className="sm:self-start">
        {editing ? "Enregistrer les modifications" : "Créer le profil"}
      </PendingButton>
    </form>
  );
}
