"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReponseCodeTelephone, ReponseEntreprise } from "@/contracts/v1/verifications";
import { TAILLE_MAX_DOCUMENT } from "@/contracts/v1/verifications";
import {
  appealAction,
  checkCompanyAction,
  confirmPhoneCodeAction,
  requestVisioAction,
  saveAddressAction,
  sendPhoneCodeAction,
  startIdentityAction,
  uploadDocumentAction,
} from "@/server/verifications/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { FormMessage } from "@/components/ui/form-message";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Input, Radio, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/**
 * L2 : formulaires du site pour la vérification de l'accompagnant (téléphone, identité, adresse, entreprise, documents).
 * Textes STE : phrases courtes, voix active, jamais « échec ». Mêmes services que l'app (API v1).
 */

function Success({ state }: { state: ActionResult<unknown> }) {
  return state.ok && state.message ? (
    <p role="status" className="rounded-md bg-feuille-soft p-3.5 text-[15px] font-semibold">
      {state.message}
    </p>
  ) : null;
}

// ─────────────── Téléphone ───────────────

export function PhoneForm({ defaultPhone, voiceOpen }: { defaultPhone: string; voiceOpen: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const send = useFormAction<ActionResult<ReponseCodeTelephone>>(sendPhoneCodeAction, initialActionState as ActionResult<ReponseCodeTelephone>);
  const confirm = useFormAction<ActionResult>(async (prev, fd) => {
    const r = await confirmPhoneCodeAction(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, initialActionState);
  const challenge = send.state.ok ? send.state.data : undefined;
  const fe = !send.state.ok ? send.state.fieldErrors : undefined;
  const ce = !confirm.state.ok ? confirm.state.fieldErrors : undefined;
  if (confirm.state.ok) return <Success state={confirm.state} />;
  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={send.onSubmit} className="flex flex-col gap-3" noValidate>
        <FormMessage state={send.state} />
        <FormField label="Votre numéro de mobile" htmlFor="telephone" hint="Martinique, Guadeloupe, Guyane, La Réunion, Mayotte ou Hexagone. Exemple : 0696 12 34 56." errors={fe?.telephone} required>
          <Input {...fieldA11y("telephone", fe?.telephone, true)} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} required />
        </FormField>
        <input type="hidden" name="canal" value="SMS" />
        <PendingButton pending={send.pending} size="lg" pendingLabel="Envoi…">
          {challenge ? "Recevoir un nouveau code" : "Recevoir un code par SMS"}
        </PendingButton>
      </form>
      {challenge?.appelPossible && voiceOpen ? (
        <form onSubmit={send.onSubmit} className="flex flex-col gap-2">
          <input type="hidden" name="telephone" value={phone} />
          <input type="hidden" name="canal" value="APPEL" />
          <p className="text-[15px]">Pas de SMS ? Ou une ligne fixe ?</p>
          <PendingButton pending={send.pending} variant="quiet" pendingLabel="Appel…">
            Recevoir un appel
          </PendingButton>
        </form>
      ) : null}
      {challenge ? (
        <form onSubmit={confirm.onSubmit} className="flex flex-col gap-3" noValidate>
          <FormMessage state={confirm.state} />
          <input type="hidden" name="challengeId" value={challenge.challengeId} />
          <FormField label="Code à 6 chiffres" htmlFor="code" hint="Le code expire dans 10 minutes. Ne le donnez à personne." errors={ce?.code} required>
            <Input {...fieldA11y("code", ce?.code, true)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </FormField>
          <PendingButton pending={confirm.pending} size="lg" pendingLabel="Vérification…">
            Vérifier le code
          </PendingButton>
        </form>
      ) : null}
    </div>
  );
}

// ─────────────── Identité ───────────────

export function IdentityStartForm({ disabled }: { disabled: boolean }) {
  const { state, onSubmit, pending } = useFormAction(startIdentityAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      <Checkbox id="consentement" name="consentement" label="J'accepte la vérification par photo de ma pièce et de mon visage (comparaison biométrique faite par le prestataire)." />
      {fe?.consentement ? (
        <p className="text-[15px] font-semibold text-hibiscus" role="alert">
          {fe.consentement.join(" ")}
        </p>
      ) : null}
      <PendingButton pending={pending} size="lg" pendingLabel="Ouverture…" className={disabled ? "pointer-events-none opacity-60" : undefined}>
        Commencer la vérification
      </PendingButton>
    </form>
  );
}

const CRENEAUX = [
  ["MATIN", "Matin (8 h – 11 h, heure de Martinique)"],
  ["MIDI", "Midi (11 h – 14 h, heure de Martinique)"],
  ["APRES_MIDI", "Après-midi (14 h – 17 h, heure de Martinique)"],
] as const;

const RAISONS = [
  ["REFUS_BIOMETRIE", "Je ne veux pas de photo de mon visage"],
  ["PAS_DE_SMARTPHONE", "Je n'ai pas d'appareil avec une caméra"],
  ["PIECE_NON_RECONNUE", "Ma pièce n'est pas reconnue"],
  ["ECHECS_REPETES", "La vérification par photo ne marche pas"],
  ["AUTRE", "Autre raison"],
] as const;

export function VisioForm() {
  const { state, onSubmit, pending } = useFormAction(requestVisioAction, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  if (state.ok) return <Success state={state} />;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      <Fieldset legend="Quand pouvez-vous faire la visio ?" errors={fe?.creneau}>
        {CRENEAUX.map(([v, l]) => (
          <Radio key={v} id={`creneau-${v}`} name="creneau" value={v} label={l} />
        ))}
      </Fieldset>
      <FormField label="Pourquoi préférez-vous une visio ?" htmlFor="raison" hint="Votre réponse ne change rien à votre dossier.">
        <Select id="raison" name="raison" defaultValue="AUTRE" aria-describedby="raison-hint">
          {RAISONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </FormField>
      <PendingButton pending={pending} variant="quiet" pendingLabel="Envoi…">
        Je préfère une visio
      </PendingButton>
    </form>
  );
}

// ─────────────── Adresse ───────────────

export function AddressForm({ hasAddress }: { hasAddress: boolean }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction<ActionResult>(async (prev, fd) => {
    const r = await saveAddressAction(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      {hasAddress ? <p className="text-[15px] text-muted">Votre adresse est enregistrée (chiffrée). Vous déménagez ? Écrivez la nouvelle adresse.</p> : null}
      <FormField label="Numéro et voie" htmlFor="ligne" hint="Exemple : 12 rue des Flamboyants." errors={fe?.ligne} required>
        <Input {...fieldA11y("ligne", fe?.ligne, true)} autoComplete="address-line1" maxLength={120} required />
      </FormField>
      <FormField label="Complément (facultatif)" htmlFor="complement" errors={fe?.complement}>
        <Input {...fieldA11y("complement", fe?.complement)} autoComplete="address-line2" maxLength={120} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormField label="Code postal" htmlFor="codePostal" errors={fe?.codePostal} required>
          <Input {...fieldA11y("codePostal", fe?.codePostal)} inputMode="numeric" autoComplete="postal-code" maxLength={5} required />
        </FormField>
        <FormField label="Commune" htmlFor="commune" errors={fe?.commune} required>
          <Input {...fieldA11y("commune", fe?.commune)} autoComplete="address-level2" maxLength={80} required />
        </FormField>
      </div>
      <PendingButton pending={pending} size="lg" pendingLabel="Enregistrement…">
        Enregistrer mon adresse
      </PendingButton>
    </form>
  );
}

// ─────────────── Documents ───────────────

export function DocumentForm({ types }: { types: readonly (readonly [string, string])[] }) {
  const router = useRouter();
  const [tooBig, setTooBig] = useState(false);
  const { state, onSubmit, pending } = useFormAction<ActionResult>(async (prev, fd) => {
    const r = await uploadDocumentAction(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, initialActionState);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate encType="multipart/form-data">
      <FormMessage state={state} />
      <FormField label="Type de document" htmlFor="type" errors={fe?.type} required>
        <Select {...fieldA11y("type", fe?.type)} defaultValue={types[0]?.[0]} required>
          {types.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Fichier" htmlFor="fichier" hint="PDF, photo JPEG ou image PNG. 5 Mo au plus. Prenez la page entière, bien éclairée." errors={tooBig ? ["Le fichier fait plus de 5 Mo."] : fe?.fichier} required>
        <input
          {...fieldA11y("fichier", fe?.fichier, true)}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > TAILLE_MAX_DOCUMENT)}
          className="min-h-11 rounded-field border-[1.5px] border-line-strong bg-surface px-3 py-2 text-[15px]"
        />
      </FormField>
      <PendingButton pending={pending} size="lg" pendingLabel="Envoi…">
        Envoyer le document
      </PendingButton>
      <p className="text-sm text-muted">Le fichier est chiffré. Seule l&apos;équipe Koudmen l&apos;ouvre. Il est effacé 30 jours après la décision.</p>
    </form>
  );
}

// ─────────────── Entreprise ───────────────

export function CompanyForm({ defaultSiret }: { defaultSiret: string }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction<ActionResult<ReponseEntreprise>>(async (prev, fd) => {
    const r = await checkCompanyAction(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, initialActionState as ActionResult<ReponseEntreprise>);
  const fe = !state.ok ? state.fieldErrors : undefined;
  const r = state.ok ? state.data : undefined;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      {r ? (
        <Alert tone={r.etat === "VALIDE" ? "succes" : "info"} title={r.etat === "VALIDE" ? "C'est vérifié" : "Une étape de plus"}>
          {r.message}
        </Alert>
      ) : null}
      <FormField label="Numéro SIRET (14 chiffres)" htmlFor="siret" hint="Il est sur votre avis de situation Sirene ou sur l'Annuaire des entreprises." errors={fe?.siret} required>
        <Input {...fieldA11y("siret", fe?.siret, true)} inputMode="numeric" defaultValue={defaultSiret} maxLength={20} required />
      </FormField>
      <PendingButton pending={pending} size="lg" pendingLabel="Contrôle…">
        Vérifier mon SIRET
      </PendingButton>
    </form>
  );
}

// ─────────────── Recours ───────────────

export function AppealForm() {
  const { state, onSubmit, pending } = useFormAction(appealAction, initialActionState);
  if (state.ok) return <Success state={state} />;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      <FormField label="Pourquoi demandez-vous un réexamen ?" htmlFor="motifRecours" required>
        <Select id="motifRecours" name="motifRecours" defaultValue="ERREUR_SUR_UN_DOCUMENT">
          <option value="ERREUR_SUR_UN_DOCUMENT">L&apos;équipe a fait une erreur sur un document</option>
          <option value="NOUVEAU_DOCUMENT">J&apos;ai un nouveau document</option>
          <option value="SITUATION_CHANGEE">Ma situation a changé</option>
          <option value="AUTRE">Autre raison (vous l&apos;expliquez à l&apos;équipe au téléphone)</option>
        </Select>
      </FormField>
      <PendingButton pending={pending} variant="quiet" pendingLabel="Envoi…">
        Demander un réexamen
      </PendingButton>
    </form>
  );
}
