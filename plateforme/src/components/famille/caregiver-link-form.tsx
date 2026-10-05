"use client";

import { inviteCaregiverRelativeAction } from "@/server/famille/actions";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { FormMessage } from "@/components/ui/form-message";
import { CopyLink } from "./copy-link";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

type LinkState = ActionResult<{ link: string; expiresAt: string }>;
const initial: LinkState = { ok: false, error: "" };

/**
 * A6 (D7) : le payeur crée un lien pour rattacher un proche aidant (un enfant ou un parent de l'aîné,
 * payé via l'APA) à cet aîné. Écran minimal du volet serveur.
 */
export function CaregiverLinkForm({ aineId, aineFirstName }: { aineId: string; aineFirstName: string }) {
  const { state, onSubmit, pending } = useFormAction(inviteCaregiverRelativeAction, initial);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-[1.45] text-muted">
        Un enfant ou un parent de {aineFirstName} veut l&apos;accompagner comme proche aidant (APA) ? Créez un lien. Il l&apos;ouvre avec son
        compte Accompagnant. Koudmen pourra alors le proposer pour {aineFirstName} seulement.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="aineId" value={aineId} />
        <FormMessage state={state.ok ? { ok: true } : state} />
        <PendingButton pending={pending} pendingLabel="Création du lien…" variant="quiet" size="lg" className="w-full">
          Créer un lien pour un proche aidant
        </PendingButton>
      </form>
      {state.ok && state.data ? (
        <div className="flex flex-col gap-3 rounded-md bg-feuille-soft p-4" role="status">
          <p className="font-bold">{state.message}</p>
          <CopyLink value={state.data.link} label="Lien pour le proche aidant" />
          <p className="text-sm">Ce lien marche une seule fois. Il expire le {formatDate(state.data.expiresAt)}.</p>
        </div>
      ) : null}
    </div>
  );
}
