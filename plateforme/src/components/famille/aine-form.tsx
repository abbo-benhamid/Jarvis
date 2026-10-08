"use client";

import { useState } from "react";
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
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

export type AineFormDefaults = {
  aineId: string;
  firstName: string;
  lastInitial: string | null;
  commune: string;
  addressHint: string | null;
  /** L1-B (L8) : adresse exacte (déchiffrée pour le gestionnaire). */
  address?: string | null;
  locationApproximate?: boolean;
  phone: string | null;
  needs: NeedType[];
  activityLevel: number;
  consentByType: ConsentBy;
  consentByName: string;
};

/**
 * F2 (création) et modification du profil de l'aîné. Garde la saisie en cas d'erreur.
 * R5 (J5) `launch` : création MINIMALE (prénom, commune, téléphone) ; l'accord est recueilli par un conseiller
 * au téléphone, jamais saisi par la famille.
 */
export function AineForm({ defaults, launch = false }: { defaults?: AineFormDefaults; launch?: boolean }) {
  const editing = Boolean(defaults);
  const minimal = launch && !editing;
  const { state, onSubmit, pending } = useFormAction(editing ? updateAineAction : createAineAction, initialActionState);
  const [consentBy, setConsentBy] = useState<ConsentBy>(defaults?.consentByType ?? "AINE");
  const fe = !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {defaults ? <input type="hidden" name="aineId" value={defaults.aineId} /> : null}
      <FormMessage state={state} />

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-[22px] leading-[1.2] font-normal tracking-[-.015em] text-balance">1. Qui est l&apos;aîné{"\u202f"}?</h2>
        <p className="text-sm text-muted">
          {minimal
            ? "Koudmen demande le minimum : le prénom, la commune et un numéro de téléphone. Un conseiller appelle l'aîné pour lui demander son accord."
            : "Koudmen demande le minimum : le prénom et l'initiale du nom suffisent."}
        </p>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormField label="Prénom" htmlFor="firstName" errors={fe?.firstName} required>
            <Input {...fieldA11y("firstName", fe?.firstName)} defaultValue={defaults?.firstName} autoComplete="off" required maxLength={60} />
          </FormField>
          {minimal ? null : <FormField label="Initiale du nom" htmlFor="lastInitial" hint="Une lettre." errors={fe?.lastInitial}>
            <Input
              {...fieldA11y("lastInitial", fe?.lastInitial, true)}
              defaultValue={defaults?.lastInitial?.replace(".", "") ?? ""}
              autoComplete="off"
              maxLength={2}
              className="max-w-24"
            />
          </FormField>}
        </div>
        {!editing ? (
          <FormField label="Votre lien avec l'aîné" htmlFor="myRelation" hint="Exemple : fille, neveu, voisine." errors={fe?.myRelation} required>
            <Input {...fieldA11y("myRelation", fe?.myRelation, true)} autoComplete="off" required maxLength={60} />
          </FormField>
        ) : null}
        <FormField
          label="Commune"
          htmlFor="commune"
          hint={minimal ? undefined : "Sans adresse exacte, Koudmen place le domicile au centre de la commune."}
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
        {/* R5 : adresse et indication seulement après la création minimale (accord de l'aîné recueilli). */}
        {minimal ? null : (
          <>
        <FormField
          label="Adresse du domicile (facultatif)"
          htmlFor="address"
          hint="Numéro et rue, ou lieu-dit. Elle sert à la carte du trajet et à la preuve de présence. Elle est chiffrée. L'accompagnant la voit seulement le jour de la visite."
          errors={fe?.address}
        >
          <Input {...fieldA11y("address", fe?.address, true)} defaultValue={defaults?.address ?? ""} autoComplete="street-address" maxLength={200} />
        </FormField>
        {editing && defaults?.address && defaults.locationApproximate ? (
          <Alert tone="attention">Cette adresse n&apos;a pas été trouvée exactement. Koudmen utilise une position approximative. Vérifiez le numéro et la rue.</Alert>
        ) : null}
        <FormField label="Indication pour trouver la maison (facultatif)" htmlFor="addressHint" hint={launch ? "Exemple : quartier, couleur du portail." : "Exemple : quartier, couleur du portail. Données d'exemple seulement."} errors={fe?.addressHint}>
          <Input {...fieldA11y("addressHint", fe?.addressHint, true)} defaultValue={defaults?.addressHint ?? ""} autoComplete="off" maxLength={160} />
        </FormField>
          </>
        )}
        <FormField
          label={minimal ? "Téléphone de l'aîné" : "Téléphone de l'aîné (facultatif)"}
          htmlFor="phone"
          hint={minimal ? "Le conseiller Koudmen appelle l'aîné à ce numéro." : "Sert à l'appel de confirmation des visites."}
          errors={fe?.phone}
          required={minimal}
        >
          <Input {...fieldA11y("phone", fe?.phone, true)} defaultValue={defaults?.phone ?? ""} type="tel" inputMode="tel" autoComplete="off" />
        </FormField>
      </Card>

      {minimal ? null : <Card className="flex flex-col gap-4">
        <h2 className="font-display text-[22px] leading-[1.2] font-normal tracking-[-.015em] text-balance">2. De quoi a-t-il besoin{"\u202f"}?</h2>
        <Alert tone="info">N&apos;écrivez aucune information médicale. Koudmen ne demande pas de diagnostic ni de traitement.</Alert>
        <Fieldset legend={launch && editing ? "Besoins (facultatif)" : "Besoins (un ou plusieurs)"} errors={fe?.needs}>
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
      </Card>}

      {launch ? (
        <Alert tone="info" title="L'accord de l'aîné">
          Un conseiller Koudmen appelle l&apos;aîné. Il lui lit une notice simple et lui demande son accord. L&apos;aîné peut dire non, ou arrêter
          plus tard. Vous pourrez faire une demande de visite après son accord.
        </Alert>
      ) : <Card className="flex flex-col gap-4">
        <h2 className="font-display text-[22px] leading-[1.2] font-normal tracking-[-.015em] text-balance">3. Son accord</h2>
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
        <div className="rounded-md bg-surface-2 px-3">
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
      </Card>}

      <PendingButton pending={pending} size="lg" pendingLabel="Enregistrement…" className="w-full">
        {editing ? "Enregistrer les modifications" : "Créer le profil"}
      </PendingButton>
    </form>
  );
}
