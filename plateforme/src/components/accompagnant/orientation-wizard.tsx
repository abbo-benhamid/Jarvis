"use client";

import { useEffect, useRef, useState } from "react";
import type { OrientationAnswers, OrientationResult } from "@/server/rules/orientation";
import { saveOrientationAction } from "@/server/accompagnant/actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { ChoiceCard } from "./choice-card";
import { OrientationResultView } from "./orientation-result";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

type Draft = Partial<OrientationAnswers>;
type Option<V extends string> = { value: V; label: string; hint?: string };

const Q1: Option<OrientationAnswers["activity"]>[] = [
  { value: "LIEN", label: "Du lien", hint: "Visites, appels, promenades, lecture." },
  { value: "COUPS_DE_MAIN", label: "Des coups de main", hint: "Courses, repas, papiers, numérique." },
  { value: "PRESENCE", label: "De la présence", hint: "Compagnie régulière, aide au repas, rendez-vous, sorties." },
  { value: "AIDE_RENFORCEE", label: "De l'aide renforcée", hint: "Toilette, transferts, nuits. Un diplôme est obligatoire." },
];
const Q2: Option<"oui" | "non">[] = [
  { value: "oui", label: "Oui, je veux être payé(e)" },
  { value: "non", label: "Non, je veux aider comme bénévole" },
];
const Q3: Option<OrientationAnswers["existingStatus"]>[] = [
  { value: "AUCUN", label: "Non, je n'ai pas de statut" },
  { value: "AUTO_ENTREPRENEUR_SAP", label: "Oui, je suis auto-entrepreneur déclaré SAP" },
  { value: "SALARIE_SAAD", label: "Oui, je travaille pour un SAAD", hint: "Service d'aide et d'accompagnement à domicile." },
];
const Q4: Option<OrientationAnswers["situations"][number]>[] = [
  { value: "ETUDIANT", label: "Étudiant(e)" },
  { value: "RETRAITE", label: "Retraité(e)" },
  { value: "DEMANDEUR_EMPLOI", label: "Demandeur d'emploi" },
  { value: "RSA", label: "Je reçois le RSA" },
  { value: "TEMPS_PARTIEL", label: "Salarié(e) à temps partiel" },
  { value: "AGENT_PUBLIC", label: "Agent public", hint: "Fonctionnaire ou contractuel de la fonction publique." },
  { value: "TITRE_SEJOUR_ETUDIANT", label: "Titre de séjour étudiant" },
];
const Q5: Option<OrientationAnswers["familyLink"]>[] = [
  { value: "AUCUN", label: "Non, pas de lien familial" },
  { value: "ENFANT_OU_PARENT", label: "Oui, je suis son enfant ou son parent" },
  { value: "CONJOINT", label: "Oui, je suis son conjoint", hint: "Mari, femme, partenaire de PACS ou concubin." },
];

const QUESTIONS = [
  "Que voulez-vous faire ?",
  "Voulez-vous être payé(e) ?",
  "Avez-vous déjà un statut professionnel ?",
  "Quelle est votre situation aujourd'hui ?",
  "Avez-vous un lien familial avec la personne que vous allez aider ?",
] as const;

const initial: ActionResult<OrientationResult> = { ok: false, error: "" };

export function OrientationWizard({
  initialResult,
  canRedo,
}: {
  initialResult: OrientationResult | null;
  canRedo: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction(saveOrientationAction, initial);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ situations: [] });
  const [showWizard, setShowWizard] = useState(initialResult === null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const result = state.ok && state.data ? state.data : null;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step, showWizard]);

  // Après l'envoi, on montre le résultat.
  useEffect(() => {
    if (result) setShowWizard(false);
  }, [result]);

  const displayed = result ?? initialResult;

  if (!showWizard && displayed) {
    return (
      <div className="flex flex-col gap-4">
        {result ? <p className="sr-only" role="status">Résultat enregistré.</p> : null}
        <OrientationResultView result={displayed} />
        <div className="flex flex-col gap-2 sm:flex-row">
          {displayed.outcome === "RECOMMANDE" ? (
            <LinkButton href="/accompagnant/profil" size="lg">
              Compléter mon profil
            </LinkButton>
          ) : null}
          {canRedo ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setDraft({ situations: [] });
                setStep(0);
                setShowWizard(true);
              }}
            >
              Refaire l&apos;orientation
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const answered = [
    draft.activity !== undefined,
    draft.paid !== undefined,
    draft.existingStatus !== undefined,
    true,
    draft.familyLink !== undefined,
  ];
  const complete = answered.every(Boolean);
  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="answers" value={JSON.stringify(draft)} />
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-muted" aria-live="polite">
          Question {step + 1} sur 5
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-mer transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3">
          <h2 ref={titleRef} tabIndex={-1} className="text-2xl font-bold outline-none">
            {QUESTIONS[step]}
          </h2>
        </legend>

        {step === 0 &&
          Q1.map((o) => (
            <ChoiceCard
              key={o.value}
              id={`q1-${o.value}`}
              name="q1"
              label={o.label}
              hint={o.hint}
              checked={draft.activity === o.value}
              onChange={() => set({ activity: o.value })}
            />
          ))}
        {step === 1 &&
          Q2.map((o) => (
            <ChoiceCard
              key={o.value}
              id={`q2-${o.value}`}
              name="q2"
              label={o.label}
              checked={draft.paid === (o.value === "oui")}
              onChange={() => set({ paid: o.value === "oui" })}
            />
          ))}
        {step === 2 &&
          Q3.map((o) => (
            <ChoiceCard
              key={o.value}
              id={`q3-${o.value}`}
              name="q3"
              label={o.label}
              hint={o.hint}
              checked={draft.existingStatus === o.value}
              onChange={() => set({ existingStatus: o.value })}
            />
          ))}
        {step === 3 && (
          <>
            <p className="text-muted">Plusieurs réponses sont possibles. Aucune ne vous concerne ? Passez à la suite.</p>
            {Q4.map((o) => (
              <ChoiceCard
                key={o.value}
                type="checkbox"
                id={`q4-${o.value}`}
                name="q4"
                label={o.label}
                hint={o.hint}
                checked={draft.situations?.includes(o.value) ?? false}
                onChange={(e) =>
                  set({
                    situations: e.target.checked
                      ? [...(draft.situations ?? []), o.value]
                      : (draft.situations ?? []).filter((s) => s !== o.value),
                  })
                }
              />
            ))}
          </>
        )}
        {step === 4 &&
          Q5.map((o) => (
            <ChoiceCard
              key={o.value}
              id={`q5-${o.value}`}
              name="q5"
              label={o.label}
              hint={o.hint}
              checked={draft.familyLink === o.value}
              onChange={() => set({ familyLink: o.value })}
            />
          ))}
      </fieldset>

      <FormMessage state={state.ok ? undefined : state} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            Question précédente
          </Button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <Button size="lg" disabled={!answered[step]} onClick={() => setStep((s) => s + 1)}>
            Question suivante
          </Button>
        ) : complete ? (
          <PendingButton pending={pending} size="lg" pendingLabel="Calcul…">
            Voir mon statut
          </PendingButton>
        ) : (
          <Button size="lg" disabled>
            Voir mon statut
          </Button>
        )}
      </div>
    </form>
  );
}
