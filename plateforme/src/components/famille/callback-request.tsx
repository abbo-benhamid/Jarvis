"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PhoneCall } from "lucide-react";
import { requestActivationAction } from "@/server/offre/actions";
import { initialActionState } from "@/lib/action-result";
import type { Creneau, SujetRappel } from "@/lib/rappel";
import { Button } from "@/components/ui/button";
import { FormField, Fieldset, fieldA11y } from "@/components/ui/form-field";
import { Input, Radio } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

export type CreneauOption = { value: Creneau; label: string };

/**
 * L4 / R8, L1d (M4) : « Demander un appel ». Aucune commande, aucun paiement (J32).
 * - Le numéro est OBLIGATOIRE (prérempli avec celui du compte) ; la personne choisit un créneau, avec l'heure de Paris.
 * - `plan = "QUESTION"` : appel pour poser une question, sans formule payante.
 * - Le bouton est désactivé pendant l'envoi ; le résultat est annoncé (`role="status"`) et rendu visible (m15).
 */
export function CallbackRequest({
  plan,
  label,
  aineId,
  defaultPhone,
  creneaux,
  pendingSince,
  startOpen = false,
  emphasis = false,
}: {
  plan: SujetRappel;
  /** Texte du bouton, ex. « Demander un appel pour la formule Sérénité ». */
  label: string;
  aineId?: string;
  defaultPhone?: string | null;
  creneaux: CreneauOption[];
  /** Date (déjà formatée) d'une demande ouverte pour ce sujet. */
  pendingSince?: string | null;
  startOpen?: boolean;
  /** P1 : bouton principal (accueil famille en préinscription). Sinon : bouton discret. */
  emphasis?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction(requestActivationAction, initialActionState);
  const [open, setOpen] = useState(startOpen);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const uid = useId().replace(/:/g, "");
  const fe = !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.ok && state.message) statusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  if (state.ok && state.message) {
    return (
      <p ref={statusRef} role="status" tabIndex={-1} className="rounded-md bg-feuille-soft p-3.5 text-[15px] leading-[1.45] font-semibold">
        {state.message}
      </p>
    );
  }
  if (pendingSince && !open) {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-md bg-surface-2 p-3.5 text-[15px] leading-[1.45] font-semibold">
          Demande envoyée le {pendingSince}. Un conseiller Koudmen vous appelle.
        </p>
        <Button variant="link" onClick={() => setOpen(true)} className="self-start">
          Changer le numéro ou le créneau
        </Button>
      </div>
    );
  }
  if (!open) {
    return (
      <Button variant={emphasis ? "primary" : "quiet"} size="lg" fullWidth onClick={() => setOpen(true)} icon={<PhoneCall strokeWidth={1.6} />} aria-expanded={false}>
        {label}
      </Button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md bg-surface-2 p-3.5" noValidate aria-label={label}>
      <input type="hidden" name="plan" value={plan} />
      {aineId ? <input type="hidden" name="aineId" value={aineId} /> : null}
      <FormMessage state={state} />
      <FormField label="Numéro où le conseiller vous appelle" htmlFor={`phone-${uid}`} hint="Avec l'indicatif du pays. Exemple : +33 6 12 34 56 78." errors={fe?.phone} required>
        <Input {...fieldA11y(`phone-${uid}`, fe?.phone, true)} name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={defaultPhone ?? ""} required maxLength={20} />
      </FormField>
      <Fieldset legend="Quand voulez-vous être appelé ?" errors={fe?.creneau}>
        <div className="flex flex-col">
          {creneaux.map((c) => (
            <Radio key={c.value} id={`creneau-${c.value}-${uid}`} name="creneau" value={c.value} label={c.label} />
          ))}
        </div>
      </Fieldset>
      <PendingButton pending={pending} pendingLabel="Envoi…" size="lg">
        Envoyer la demande
      </PendingButton>
      <Button variant="link" onClick={() => setOpen(false)} disabled={pending}>
        Annuler
      </Button>
    </form>
  );
}
