"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareHeart, X } from "lucide-react";
import { submitFeedbackAction } from "@/server/feedback";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { Textarea } from "@/components/ui/input";
import { FormField, Fieldset } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";

const RATINGS = [
  { value: 1, label: "Très mauvais" },
  { value: 2, label: "Mauvais" },
  { value: 3, label: "Moyen" },
  { value: 4, label: "Bien" },
  { value: 5, label: "Très bien" },
];

/** Bouton flottant « Donner mon avis », présent sur toutes les pages (root layout). */
export function FeedbackButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  const open = () => {
    setFormKey((k) => k + 1); // nouveau formulaire vierge à chaque ouverture
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      {/*
        Mobile : bouton rond (icône seule, nom accessible conservé) pour ne pas masquer le contenu.
        Le contenu a une marge basse (pb-24 dans le layout racine) : la fin de page reste lisible.
      */}
      <Button
        variant="soleil"
        onClick={open}
        className="fixed right-3 bottom-3 z-40 size-14 rounded-full p-0 shadow-lg sm:right-4 sm:bottom-4 sm:size-auto sm:px-4 sm:py-2 print:hidden"
        aria-haspopup="dialog"
        aria-label="Donner mon avis"
      >
        <MessageSquareHeart aria-hidden="true" size={22} />
        <span className="max-sm:sr-only">Donner mon avis</span>
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-title"
        className="m-auto w-[min(100%-2rem,32rem)] rounded-xl border border-line bg-surface p-0 text-fg shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="feedback-title" className="text-xl font-bold">
            Donner mon avis
          </h2>
          <Button variant="ghost" aria-label="Fermer" onClick={close}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <FeedbackForm key={formKey} onDone={close} />
      </dialog>
    </>
  );
}

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  // Hook du socle : le message reste en place après une erreur (pas de remise à zéro par React 19).
  const { state, onSubmit, pending } = useFormAction(submitFeedbackAction, initialActionState);

  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 px-5 py-4">
      <input type="hidden" name="pagePath" value={pathname} />
      <Fieldset legend="Votre note" errors={!state.ok ? state.fieldErrors?.rating : undefined}>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => (
            <label
              key={r.value}
              className="flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg border border-line px-3 has-[:checked]:border-mer has-[:checked]:bg-mer-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]"
            >
              <input type="radio" name="rating" value={r.value} className="sr-only" required />
              <span className="text-lg font-bold">{r.value}</span>
              <span className="text-xs text-muted">{r.label}</span>
            </label>
          ))}
        </div>
      </Fieldset>
      <FormField
        label="Votre message"
        htmlFor="feedback-message"
        hint="Qu'est-ce qui marche ? Qu'est-ce qui bloque ? N'écrivez pas de donnée personnelle réelle."
        errors={!state.ok ? state.fieldErrors?.message : undefined}
        required
      >
        <Textarea id="feedback-message" name="message" required minLength={3} maxLength={2000} />
      </FormField>
      <p className="text-sm text-muted">Page concernée : {pathname}</p>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <PendingButton pending={pending} pendingLabel="Envoi…">
          Envoyer mon avis
        </PendingButton>
      </div>
    </form>
  );
}
