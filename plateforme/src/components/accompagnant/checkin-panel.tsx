"use client";

import { startTransition, useActionState, useState } from "react";
import { KeyRound, LogOut, MapPin } from "lucide-react";
import {
  checkOutAction,
  codeCheckInAction,
  gpsCheckInAction,
  simulateGpsAction,
  type CheckInData,
} from "@/server/accompagnant/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { PendingButton, useFormAction } from "@/components/ui/use-form-action";

const initialGps: ActionResult<CheckInData> = { ok: false, error: "" };

function StepTitle({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-bold">
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-mer text-on-mer">
        {n}
      </span>
      <span aria-hidden="true" className="text-mer">
        {icon}
      </span>
      {children}
    </h2>
  );
}

/**
 * Check-in en 2 preuves possibles + check-out.
 * RM-08 : la position est lue UNE fois, au check-in, après accord explicite. Jamais au check-out.
 */
export function CheckInPanel({
  visitId,
  canAddProof,
  gpsValid,
  codeValid,
  checkedIn,
  checkedOut,
  testMode,
}: {
  visitId: string;
  canAddProof: boolean;
  gpsValid: boolean;
  codeValid: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
  testMode: boolean;
}) {
  const [gpsState, gpsAction, gpsPending] = useActionState(gpsCheckInAction, initialGps);
  const [simState, simAction] = useActionState(simulateGpsAction, initialGps);
  const { state: codeState, onSubmit: onCode, pending: codePending } = useFormAction(codeCheckInAction, initialActionState);
  const [outState, outAction] = useActionState(checkOutAction, initialActionState);
  const [consent, setConsent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const codeErrors = !codeState.ok ? codeState.fieldErrors?.code : undefined;

  function readPositionOnce() {
    setGeoError(null);
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

  return (
    <div className="flex flex-col gap-4">
      {/* 1 — Position, une seule fois */}
      <Card className="flex flex-col gap-3">
        <StepTitle n={1} icon={<MapPin className="size-6" />}>
          Ma position, une seule fois
        </StepTitle>
        {gpsValid ? (
          <Alert tone="succes">Position enregistrée. Vous êtes au domicile.</Alert>
        ) : !canAddProof ? (
          <p className="text-muted">La position n&apos;est plus demandée pour cette visite.</p>
        ) : (
          <>
            <p>
              Koudmen lit votre position <strong>une seule fois, maintenant</strong>, pour prouver votre arrivée. Pas de suivi pendant la
              visite. Pas de position au départ.
            </p>
            <Checkbox
              id={`gps-consent-${visitId}`}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              label="J'accepte de partager ma position une fois pour cette visite."
            />
            <Button size="lg" disabled={!consent || locating || gpsPending} onClick={readPositionOnce} aria-busy={locating || gpsPending}>
              {locating ? "Lecture de la position…" : gpsPending ? "Envoi…" : "Partager ma position"}
            </Button>
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
                <SubmitButton variant="secondary" pendingLabel="Simulation…">
                  Simuler ma position au domicile
                </SubmitButton>
                <FormMessage state={simState} />
              </form>
            ) : null}
          </>
        )}
      </Card>

      {/* 2 — Code du domicile */}
      <Card className="flex flex-col gap-3">
        <StepTitle n={2} icon={<KeyRound className="size-6" />}>
          Code du domicile
        </StepTitle>
        {codeValid ? (
          <Alert tone="succes">Code correct. Preuve enregistrée.</Alert>
        ) : !canAddProof ? (
          <p className="text-muted">Le code n&apos;est plus demandé pour cette visite.</p>
        ) : (
          <form onSubmit={onCode} className="flex flex-col gap-3">
            <input type="hidden" name="visitId" value={visitId} />
            <FormField
              label="Code à 6 caractères"
              htmlFor="code"
              hint="Le code est affiché chez l'aîné. Majuscules ou minuscules : pas de différence."
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
                className="max-w-56 font-mono text-3xl font-bold tracking-[0.3em]"
              />
            </FormField>
            <FormMessage state={codeState} />
            <PendingButton pending={codePending} size="lg" pendingLabel="Vérification…">
              Valider le code
            </PendingButton>
          </form>
        )}
      </Card>

      {/* 3 — Départ (check-out) */}
      <Card className="flex flex-col gap-3">
        <StepTitle n={3} icon={<LogOut className="size-6" />}>
          Fin de la visite
        </StepTitle>
        {checkedOut ? (
          <p>Départ enregistré.</p>
        ) : !checkedIn ? (
          <p className="text-muted">Faites d&apos;abord l&apos;étape 1 ou 2.</p>
        ) : (
          <form action={outAction} className="flex flex-col gap-3">
            <input type="hidden" name="visitId" value={visitId} />
            <p>Aucune position n&apos;est lue au départ.</p>
            <FormMessage state={outState} />
            <SubmitButton variant="secondary" size="lg" pendingLabel="Enregistrement…">
              Je pars
            </SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
