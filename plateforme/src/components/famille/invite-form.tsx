"use client";

import { inviteLakouAction } from "@/server/famille/actions";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { CopyLink } from "./copy-link";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

type InviteState = ActionResult<{ link: string; expiresAt: string }>;
const initial: InviteState = { ok: false, error: "" };

/** F4 : formulaire d'invitation au cercle Lakou. Affiche le lien copiable après création. */
export function InviteForm({ aineId, aineFirstName, launch = false }: { aineId: string; aineFirstName: string; launch?: boolean }) {
  const { state, onSubmit, pending } = useFormAction(inviteLakouAction, initial);
  const fe = !state.ok ? state.fieldErrors : undefined;
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="aineId" value={aineId} />
        <FormMessage state={state.ok ? { ok: true } : state} />
        <FormField
          label={`Lien de cette personne avec ${aineFirstName}`}
          htmlFor="relation"
          hint="Exemple : fils, petite-fille, voisine."
          errors={fe?.relation}
          required
        >
          <Input {...fieldA11y("relation", fe?.relation, true)} autoComplete="off" required maxLength={60} />
        </FormField>
        <FormField
          label="Adresse e-mail de la personne (facultatif)"
          htmlFor="email"
          hint={launch ? "Si vous indiquez une adresse e-mail, Koudmen envoie le lien. Sinon, copiez le lien vous-même." : "Si vous indiquez une adresse e-mail, Koudmen envoie le lien (envoi simulé dans la démo). Sinon, copiez le lien vous-même."}
          errors={fe?.email}
        >
          <Input {...fieldA11y("email", fe?.email, true)} type="email" autoComplete="off" inputMode="email" />
        </FormField>
        <PendingButton pending={pending} pendingLabel="Création du lien…" size="lg" className="w-full">
          Créer le lien d&apos;invitation
        </PendingButton>
      </form>
      {state.ok && state.data ? (
        <div className="flex flex-col gap-3 rounded-md bg-feuille-soft p-4" role="status">
          <p className="font-bold">{state.message}</p>
          <CopyLink value={state.data.link} />
          <p className="text-sm">Ce lien marche une seule fois. Il expire le {formatDate(state.data.expiresAt)}.</p>
        </div>
      ) : null}
    </div>
  );
}
