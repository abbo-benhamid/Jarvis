"use client";

import { startTransition, useActionState, useState } from "react";
import { BookOpen, KeyRound, LogOut, MapPin, NotebookPen, Phone } from "lucide-react";
import {
  checkOutAction,
  codeCheckInAction,
  gpsCheckInAction,
  simulateGpsAction,
  type CheckInData,
} from "@/server/accompagnant/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { ActionDock } from "@/components/ui/action-dock";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { ProofSteps, type ProofStep } from "@/components/ui/proof-steps";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { PROOFS_NEEDED } from "./visit-display";

const initialGps: ActionResult<CheckInData> = { ok: false, error: "" };

type Active = "gps" | "code" | null;

/**
 * Preuve d'arrivée pas à pas (maquette, écran d) + départ.
 * Une seule action à la fois, au pouce (pied d'action). 2 preuves sur 3 suffisent.
 * RM-08 : la position est lue UNE fois, au check-in, après accord explicite. Jamais au check-out.
 */
export function CheckInPanel({
  visitId,
  aineFirstName,
  canAddProof,
  gpsValid,
  codeValid,
  aineConfirmed,
  score,
  checkedIn,
  checkInLabel,
  checkedOut,
  hasJournal,
  testMode,
}: {
  visitId: string;
  aineFirstName: string;
  canAddProof: boolean;
  gpsValid: boolean;
  codeValid: boolean;
  aineConfirmed: boolean;
  score: number;
  checkedIn: boolean;
  /** Heure d'arrivée lisible (« 9 h 58 »), si l'arrivée est enregistrée. */
  checkInLabel: string | null;
  checkedOut: boolean;
  hasJournal: boolean;
  testMode: boolean;
}) {
  const [gpsState, gpsAction, gpsPending] = useActionState(gpsCheckInAction, initialGps);
  const [simState, simAction] = useActionState(simulateGpsAction, initialGps);
  const { state: codeState, onSubmit: onCode, pending: codePending } = useFormAction(codeCheckInAction, initialActionState);
  const [outState, outAction] = useActionState(checkOutAction, initialActionState);
  const [consent, setConsent] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [choice, setChoice] = useState<Active>(null);
  const codeErrors = !codeState.ok ? codeState.fieldErrors?.code : undefined;

  const gpsOpen = canAddProof && !gpsValid;
  const codeOpen = canAddProof && !codeValid;
  // L'étape en cours : le choix de la personne, sinon la position, sinon le code.
  const active: Active =
    choice === "gps" && gpsOpen ? "gps" : choice === "code" && codeOpen ? "code" : gpsOpen ? "gps" : codeOpen ? "code" : null;
  const codeFormId = `code-${visitId}`;
  const consentId = `gps-consent-${visitId}`;

  function readPositionOnce() {
    setGeoError(null);
    if (!consent) {
      setNeedConsent(true);
      document.getElementById(consentId)?.focus();
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeoError("Votre téléphone ne donne pas la position. Utilisez le code du domicile.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const fd = new FormData();
        fd.set("visitId", visitId);
        fd.set("consent", "oui");
        fd.set("latitude", String(pos.coords.latitude));
        fd.set("longitude", String(pos.coords.longitude));
        fd.set("accuracy", String(Math.round(pos.coords.accuracy)));
        startTransition(() => gpsAction(fd));
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Vous n'avez pas autorisé la position. Pas de problème : utilisez le code du domicile."
            : "Position introuvable (réseau faible ?). Utilisez le code du domicile.",
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  }

  const todo = <Badge tone="soleil">À faire</Badge>;
  const ok = <span className="font-semibold text-feuille">OK</span>;
  const steps: ProofStep[] = [
    {
      icon: <MapPin />,
      label: "Position au domicile",
      detail: gpsValid ? "Position enregistrée. Vous êtes au domicile." : gpsOpen ? "Lue une seule fois, avec votre accord" : "Plus demandée pour cette visite",
      state: gpsValid ? "done" : active === "gps" ? "current" : "todo",
      aside: gpsValid ? ok : active === "gps" ? todo : undefined,
    },
    {
      icon: <KeyRound />,
      label: "Code du domicile",
      detail: codeValid ? "Code correct. Preuve enregistrée." : codeOpen ? `Affiché chez ${aineFirstName}` : "Plus demandé pour cette visite",
      state: codeValid ? "done" : active === "code" ? "current" : "todo",
      aside: codeValid ? ok : active === "code" ? todo : undefined,
    },
    {
      icon: <Phone />,
      label: `Appel à ${aineFirstName}`,
      detail: aineConfirmed ? `${aineFirstName} a confirmé la visite` : `${aineFirstName} confirme par téléphone en fin de visite`,
      state: aineConfirmed ? "done" : "todo",
      aside: aineConfirmed ? ok : undefined,
    },
  ];

  const missing = Math.max(0, PROOFS_NEEDED - score);
  const hint = checkedIn
    ? `${checkInLabel ? `Arrivée à ${checkInLabel}. ` : ""}${missing === 0 ? "Visite prouvée." : `Encore ${missing} preuve${missing > 1 ? "s" : ""}.`}`
    : active
      ? "Deux preuves sur trois suffisent."
      : undefined;

  const dockAction =
    active === "gps" ? (
      <Button size="xl" fullWidth icon={<MapPin strokeWidth={1.6} />} onClick={readPositionOnce} disabled={locating || gpsPending} aria-busy={locating || gpsPending}>
        {locating ? "Lecture de la position…" : gpsPending ? "Envoi…" : "Partager ma position"}
      </Button>
    ) : active === "code" ? (
      <Button type="submit" form={codeFormId} size="xl" fullWidth icon={<KeyRound strokeWidth={1.6} />} disabled={codePending} aria-busy={codePending}>
        {codePending ? "Vérification…" : "Valider le code"}
      </Button>
    ) : hasJournal ? (
      <LinkButton href={`/accompagnant/visites/${visitId}/kaye`} variant="quiet" size="lg" fullWidth icon={<BookOpen strokeWidth={1.6} />}>
        Lire le Kayé envoyé
      </LinkButton>
    ) : checkedIn ? (
      <LinkButton href={`/accompagnant/visites/${visitId}/kaye`} size="xl" fullWidth icon={<NotebookPen strokeWidth={1.6} />}>
        Écrire le Kayé (2 minutes)
      </LinkButton>
    ) : null;

  return (
    <div className="flex flex-col">
      <SectionHeader title={`Preuve d'arrivée · ${PROOFS_NEEDED} sur 3 suffisent`} action={<span className="num text-[15px] font-semibold text-fg">{score} sur 3</span>} />
      <Card padding="none" className="px-[18px] py-1">
        <ProofSteps steps={steps} />
      </Card>

      {active === "gps" ? (
        <Card className="mt-4 flex flex-col gap-3" aria-labelledby={`gps-titre-${visitId}`}>
          <h2 id={`gps-titre-${visitId}`} className="font-sans text-[17px] leading-[1.3] font-semibold">
            Ma position, une seule fois
          </h2>
          <p className="text-[15px] leading-[1.45]">
            Koudmen lit votre position <strong>une seule fois, maintenant</strong>, pour prouver votre arrivée. Pas de suivi pendant la
            visite. Pas de position au départ.
          </p>
          <div>
            <Checkbox
              id={consentId}
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setNeedConsent(false);
              }}
              label="J'accepte de partager ma position une fois pour cette visite."
            />
            <p role="status" className="mt-1 text-[15px] font-semibold text-hibiscus">
              {needConsent && !consent ? "Cochez la case pour partager votre position." : ""}
            </p>
          </div>
          {geoError ? <Alert tone="attention">{geoError}</Alert> : null}
          {gpsState.ok && gpsState.message ? (
            <Alert tone={gpsState.data?.valid ? "succes" : "attention"}>{gpsState.message}</Alert>
          ) : (
            <FormMessage state={gpsState} />
          )}
          {testMode ? (
            <form action={simAction} className="flex flex-col gap-2 border-t border-line pt-3">
              <input type="hidden" name="visitId" value={visitId} />
              <p className="text-sm text-muted">Mode test : vous n&apos;êtes pas en Martinique ? Simulez la position.</p>
              <SubmitButton variant="quiet" pendingLabel="Simulation…">
                Simuler ma position au domicile
              </SubmitButton>
              <FormMessage state={simState} />
            </form>
          ) : null}
          {codeOpen ? (
            <Button variant="link" onClick={() => setChoice("code")} className="self-start px-0">
              Pas de position ? Saisir le code du domicile
            </Button>
          ) : null}
        </Card>
      ) : null}

      {active === "code" ? (
        <Card className="mt-4 flex flex-col gap-3" aria-labelledby={`code-titre-${visitId}`}>
          <h2 id={`code-titre-${visitId}`} className="font-sans text-[17px] leading-[1.3] font-semibold">
            Code du domicile
          </h2>
          <form id={codeFormId} onSubmit={onCode} className="flex flex-col gap-3">
            <input type="hidden" name="visitId" value={visitId} />
            <FormField
              label="Code à 6 caractères"
              htmlFor="code"
              hint={`Le code est affiché chez ${aineFirstName}. Majuscules ou minuscules : pas de différence.`}
              errors={codeErrors}
            >
              <Input
                {...fieldA11y("code", codeErrors, true)}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={12}
                placeholder="ABC234"
                className="num max-w-60 font-mono text-[28px] font-semibold tracking-[0.3em]"
              />
            </FormField>
            <FormMessage state={codeState} />
          </form>
          {gpsOpen ? (
            <Button variant="link" onClick={() => setChoice("gps")} className="self-start px-0">
              Partager ma position à la place
            </Button>
          ) : null}
        </Card>
      ) : null}

      {checkedIn ? (
        <>
          <SectionHeader title="Fin de la visite" />
          <Card className="flex flex-col gap-3">
            {checkedOut ? (
              <p className="flex items-center gap-2">
                <LogOut aria-hidden="true" className="size-5 shrink-0 text-feuille" strokeWidth={1.6} />
                Départ enregistré.
              </p>
            ) : (
              <form action={outAction} className="flex flex-col gap-3">
                <input type="hidden" name="visitId" value={visitId} />
                <p className="text-[15px] text-muted">Vous partez ? Dites-le. Aucune position n&apos;est lue au départ.</p>
                <FormMessage state={outState} />
                <SubmitButton variant="quiet" size="lg" pendingLabel="Enregistrement…" className="w-full">
                  <LogOut aria-hidden="true" />
                  Je pars
                </SubmitButton>
              </form>
            )}
          </Card>
        </>
      ) : null}

      {dockAction ? (
        <ActionDock label="Action principale" hint={hint}>
          {dockAction}
        </ActionDock>
      ) : null}
    </div>
  );
}
