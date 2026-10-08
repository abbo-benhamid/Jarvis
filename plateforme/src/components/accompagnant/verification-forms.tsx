"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";
import type { VerificationStatus, VerificationType } from "@prisma/client";
import { declareVerificationAction, submitForReviewAction } from "@/server/accompagnant/actions";
import { initialActionState } from "@/lib/action-result";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS } from "@/lib/labels";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { Checkbox, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

const TONE: Record<VerificationStatus, BadgeTone> = {
  A_FOURNIR: "soleil",
  DECLARE: "mer",
  VALIDE: "feuille",
  REFUSE: "hibiscus",
  EN_COURS: "mer",
  A_REVOIR: "mer",
  EXPIRE: "soleil",
};

const EXAMPLES: Record<VerificationType, string> = {
  IDENTITE: "Exemple : carte d'identité valable jusqu'en 2031.",
  CASIER_B3: "Exemple : extrait demandé le 2 octobre sur casier-judiciaire.justice.gouv.fr.",
  REFERENCES: "Exemple : deux anciens employeurs, coordonnées données à l'équipe.",
  FORMATION: "Exemple : module Koudmen suivi le 3 octobre.",
  STATUT_PRO: "Exemple : numéro d'entreprise actif, déclaré pour les services à la personne.",
  PSC1: "Exemple : formation aux premiers secours suivie en 2024.",
  DIPLOME: "Exemple : diplôme d'accompagnant éducatif et social obtenu en 2019.",
  TELEPHONE: "",
  ADRESSE: "",
  ENTREPRISE: "",
};

export type VerificationRowData = {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  declaration: string | null;
  reviewNote: string | null;
};

export function VerificationRow({ item }: { item: VerificationRowData }) {
  const { state, onSubmit, pending } = useFormAction(declareVerificationAction, initialActionState);
  const [text, setText] = useState(item.declaration ?? "");
  const fe = !state.ok ? state.fieldErrors : undefined;
  const id = `declaration-${item.id}`;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-[17px] leading-[1.3] font-semibold">{VERIFICATION_TYPE_LABELS[item.type]}</h2>
        <Badge tone={TONE[item.status]}>{VERIFICATION_STATUS_LABELS[item.status]}</Badge>
      </div>
      {item.status === "REFUSE" && item.reviewNote ? (
        <p className="text-sm">
          <strong>Note de l&apos;équipe :</strong> {item.reviewNote}
        </p>
      ) : null}
      {item.status === "VALIDE" ? (
        <p className="text-[15px] text-muted">L&apos;équipe Koudmen a validé ce point.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="itemId" value={item.id} />
          <FormMessage state={state} />
          {/* R6 (J6) : casier B3 = aucun texte. L'extrait est montré au rendez-vous ; l'équipe note seulement la date. */}
          {item.type === "CASIER_B3" ? (
            <p className="text-[15px]">
              Montrez votre extrait de casier judiciaire (bulletin n° 3) à l&apos;équipe Koudmen, au rendez-vous. Koudmen ne garde aucune copie. L&apos;équipe note
              seulement la date.
            </p>
          ) : (
          <FormField label={`Votre déclaration — ${VERIFICATION_TYPE_LABELS[item.type]}`} htmlFor={id} hint={EXAMPLES[item.type]} errors={fe?.declaration}>
            <Textarea
              {...fieldA11y(id, fe?.declaration, true)}
              name="declaration"
              rows={2}
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </FormField>
          )}
          <PendingButton pending={pending} variant={item.status === "DECLARE" ? "quiet" : "primary"} size="lg" pendingLabel="Enregistrement…" className="w-full">
            {item.type === "CASIER_B3" ? (item.status === "DECLARE" ? "C'est noté" : "Je montrerai mon extrait B3") : item.status === "DECLARE" ? "Modifier ma déclaration" : "J'ai fourni"}
          </PendingButton>
        </form>
      )}
    </Card>
  );
}

/** Texte enregistré quand le testeur coche « J'ai ce document » (aucun fichier, aucune donnée réelle). */
const QUICK_DECLARATION = "Document déclaré par case à cocher (démo).";

/**
 * S1b-ux M11 : dans un monde de test, une case « J'ai ce document » par point et UN seul bouton.
 * Le bouton déclare les points cochés, puis demande la vérification (actions serveur existantes, sans changement).
 */
export function QuickDeclareForm({ items, canRequestReview }: { items: VerificationRowData[]; canRequestReview: boolean }) {
  const router = useRouter();
  const open = items.filter((i) => i.status !== "VALIDE");
  const [checked, setChecked] = useState<string[]>(open.filter((i) => i.status === "DECLARE").map((i) => i.id));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const allChecked = open.every((i) => checked.includes(i.id));

  const submit = () => {
    setError(null);
    setDone(null);
    if (!allChecked) {
      setError(`Cochez les ${open.length} documents pour demander la vérification.`);
      return;
    }
    startTransition(async () => {
      for (const item of open.filter((i) => i.status !== "DECLARE")) {
        const fd = new FormData();
        fd.set("itemId", item.id);
        fd.set("declaration", QUICK_DECLARATION);
        const r = await declareVerificationAction(initialActionState, fd);
        if (!r.ok) {
          setError(`${VERIFICATION_TYPE_LABELS[item.type]} : ${r.error}`);
          return;
        }
      }
      if (canRequestReview) {
        const r = await submitForReviewAction(initialActionState);
        if (!r.ok) {
          setError(r.error);
          router.refresh();
          return;
        }
        setDone(r.message ?? "Demande envoyée.");
      } else {
        setDone("Documents déclarés. Complétez votre profil, puis demandez la vérification.");
      }
      router.refresh();
    });
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-sans text-[17px] leading-[1.3] font-semibold">Vos documents</h2>
      <p className="text-[15px] text-muted">Démo : aucun fichier à envoyer. Cochez les documents que vous avez.</p>
      <fieldset className="flex flex-col divide-y divide-line">
        <legend className="sr-only">Documents que vous avez</legend>
        {items.map((i) => (
          <div key={i.id} className="flex flex-col">
            {i.status === "VALIDE" ? (
              <p className="flex min-h-11 items-center gap-2">
                <Badge tone="feuille">Validé</Badge> {VERIFICATION_TYPE_LABELS[i.type]}
              </p>
            ) : (
              <Checkbox
                id={`doc-${i.id}`}
                checked={checked.includes(i.id)}
                onChange={(e) => setChecked((c) => (e.target.checked ? [...c, i.id] : c.filter((x) => x !== i.id)))}
                label={<>J&apos;ai ce document : {VERIFICATION_TYPE_LABELS[i.type]}</>}
              />
            )}
            {i.status === "REFUSE" && i.reviewNote ? (
              <p className="pb-2 pl-8 text-sm">
                <strong>Note de l&apos;équipe :</strong> {i.reviewNote}
              </p>
            ) : null}
          </div>
        ))}
      </fieldset>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {done ? <Alert tone="succes">{done}</Alert> : null}
      <Button size="xl" fullWidth onClick={submit} disabled={pending} aria-busy={pending}>
        {pending ? "Envoi…" : canRequestReview ? "Déclarer et demander la vérification" : "Déclarer mes documents"}
      </Button>
    </Card>
  );
}

export function SubmitReviewForm() {
  const [state, action] = useActionState(submitForReviewAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <SubmitButton size="xl" pendingLabel="Envoi…" className="w-full">
        Demander la vérification
      </SubmitButton>
    </form>
  );
}
