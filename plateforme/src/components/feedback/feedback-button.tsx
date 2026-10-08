"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareHeart, X } from "lucide-react";
import { submitFeedbackAction } from "@/server/feedback";
import { initialActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import { Textarea } from "@/components/ui/input";
import { FormField, Fieldset } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { FEEDBACK_SENT_EVENT, OPEN_FEEDBACK_EVENT, type FeedbackContext } from "./open-feedback";

const RATINGS = [
  { value: 1, label: "Très mauvais" },
  { value: 2, label: "Mauvais" },
  { value: 3, label: "Moyen" },
  { value: 4, label: "Bien" },
  { value: 5, label: "Très bien" },
];

/** Noms simples des pages (m15) : jamais de chemin technique devant le testeur. */
function pageName(path: string): string {
  if (path === "/") return "Accueil";
  const names: [RegExp, string][] = [
    [/^\/famille\/kaye/, "Kayé"],
    [/^\/famille\/visites/, "Visites (famille)"],
    [/^\/famille\/demandes/, "Demandes"],
    [/^\/famille\/formule/, "Formules"],
    [/^\/famille\/visite-decouverte/, "Visite découverte"],
    [/^\/famille\/aines\/[^/]+\/cercle/, "Cercle Lakou"],
    [/^\/famille\/aines/, "Fiche de l'aîné"],
    [/^\/famille/, "Accueil famille"],
    [/^\/accompagnant\/propositions/, "Propositions"],
    [/^\/accompagnant\/visites\/[^/]+\/kaye/, "Écrire le Kayé"],
    [/^\/accompagnant\/visites/, "Visites (accompagnant)"],
    [/^\/accompagnant\/profil/, "Mon profil"],
    [/^\/accompagnant\/verifications/, "Vérifications"],
    [/^\/accompagnant\/orientation/, "Mon statut"],
    [/^\/accompagnant/, "Accueil accompagnant"],
    [/^\/tester/, "Essayer la démo"],
    [/^\/fin-de-scenario/, "Fin de scénario"],
  ];
  return names.find(([re]) => re.test(path))?.[1] ?? "Cette page";
}

/**
 * « Donner mon avis » (A9, S1b-ux M4) : bouton DANS le flux, en bas de chaque page (il ne masque plus rien).
 * La fenêtre s'ouvre aussi depuis le panneau du test et depuis l'écran de fin de scénario (événement « koudmen:avis »).
 */
export function FeedbackButton({ launch = false }: { launch?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [context, setContext] = useState<FeedbackContext>({});

  const open = useCallback((ctx: FeedbackContext = {}) => {
    setContext(ctx);
    setFormKey((k) => k + 1); // nouveau formulaire vierge à chaque ouverture
    dialogRef.current?.showModal();
  }, []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    const onOpen = (e: Event) => open((e as CustomEvent<FeedbackContext>).detail ?? {});
    window.addEventListener(OPEN_FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, onOpen);
  }, [open]);

  return (
    <>
      <aside aria-label="Votre avis" className="mx-auto w-full max-w-[var(--content-max)] px-5 pb-8 lg:px-6 print:hidden">
        <Button variant="quiet" onClick={() => open()} aria-haspopup="dialog" className="rounded-full pr-5 pl-4">
          <MessageSquareHeart aria-hidden="true" className="text-soleil-ink" strokeWidth={1.6} />
          Donner mon avis
        </Button>
      </aside>
      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-title"
        className="m-auto w-[min(100%-2rem,32rem)] rounded-card bg-surface p-0 text-fg shadow-float"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="feedback-title" className="font-display text-[24px] leading-tight font-normal">
            {context.title ?? "Donner mon avis"}
          </h2>
          <Button variant="ghost" aria-label="Fermer" onClick={close}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <FeedbackForm key={formKey} context={context} onDone={close} launch={launch} />
      </dialog>
    </>
  );
}

function FeedbackForm({ context, onDone, launch }: { context: FeedbackContext; onDone: () => void; launch: boolean }) {
  const pathname = usePathname();
  const pagePath = context.pagePath ?? pathname;
  // Hook du socle : le message reste en place après une erreur (pas de remise à zéro par React 19).
  const { state, onSubmit, pending } = useFormAction(submitFeedbackAction, initialActionState);

  useEffect(() => {
    if (!state.ok) return;
    if (context.id) window.dispatchEvent(new CustomEvent(FEEDBACK_SENT_EVENT, { detail: context.id }));
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [state, onDone, context.id]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 px-5 py-4">
      <input type="hidden" name="pagePath" value={pagePath} />
      <FormMessage state={state} />
      <Fieldset legend={context.title ? "Votre note pour ce scénario" : "Votre note pour cette page"} errors={!state.ok ? state.fieldErrors?.rating : undefined}>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => (
            <label
              key={r.value}
              className="flex min-h-14 min-w-14 flex-1 cursor-pointer flex-col items-center justify-center rounded-field border-[1.5px] border-line-strong px-2 has-[:checked]:border-mer has-[:checked]:bg-mer-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]"
            >
              <input type="radio" name="rating" value={r.value} className="sr-only" required />
              <span className="num text-lg font-semibold">{r.value}</span>
              <span className="text-xs">{r.label}</span>
            </label>
          ))}
        </div>
      </Fieldset>
      <FormField
        label={context.question ?? "Votre message"}
        htmlFor="feedback-message"
        hint={launch ? "Qu'est-ce qui marche ? Qu'est-ce qui bloque ? N'écrivez pas d'information sur votre santé ou celle d'un proche." : "Qu'est-ce qui marche ? Qu'est-ce qui bloque ? N'écrivez pas de donnée personnelle réelle."}
        errors={!state.ok ? state.fieldErrors?.message : undefined}
        required
      >
        <Textarea id="feedback-message" name="message" required minLength={3} maxLength={2000} />
      </FormField>
      <p className="text-sm text-muted">Page : {pageName(pagePath)}</p>
      <div className="flex justify-end">
        <PendingButton pending={pending} size="lg" className="max-sm:w-full" pendingLabel="Envoi…">
          Envoyer mon avis
        </PendingButton>
      </div>
    </form>
  );
}
