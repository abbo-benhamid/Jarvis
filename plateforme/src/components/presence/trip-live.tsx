"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Navigation } from "lucide-react";
import type { ReponseTrajetFamille } from "@/contracts/v1/trajet";
import { Card } from "@/components/ui/card";
import { TripMapClient } from "./trip-map-client";
import { hourIn, ZonedTime } from "@/components/ui/zoned-time";
import { fuseauDe, territoire, TERRITOIRE_LANCEMENT, type CodeTerritoire } from "@/lib/territoires";

/** Intervalle d'interrogation (L7 : pas de WebSocket sur Vercel). */
export const POLL_MS = 10_000;

/** L1d (m7) : format unique « 9 h 30 », heure du territoire de l'aîné (T4). */
const time = (iso: string, territoire?: CodeTerritoire) => hourIn(new Date(iso), fuseauDe(territoire));

function distanceLabel(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Phrase principale, en français simple. Hors trajet : seulement l'heure prévue (R4 : jamais « non partagé »). */
export function tripHeadline(v: ReponseTrajetFamille): string {
  const p = v.accompagnant.prenom;
  switch (v.etat) {
    case "EN_ROUTE":
      return `${p} est en route. Arrivée dans ${v.minutesEstimees ?? 1} min environ.`;
    case "COMMENCEE":
      return `${p} est arrivé(e). La visite a commencé.`;
    case "TERMINEE":
      return "La visite est terminée.";
    default:
      return `Visite prévue à ${time(v.heurePrevue, v.territoire)} (${territoire(v.territoire ?? TERRITOIRE_LANCEMENT).libelleHeure}) avec ${p}.`;
  }
}

/**
 * L1-B (L6, L7) : « Où en est la visite ». Interroge l'API toutes les 10 s (en pause si l'onglet est caché).
 * La carte a une alternative textuelle : la liste sous la carte. Les mises à jour sont annoncées poliment.
 */
export function TripLive({ visitId, initial }: { visitId: string; initial: ReponseTrajetFamille }) {
  const [view, setView] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/famille/visites/${encodeURIComponent(visitId)}/trajet`, { cache: "no-store" });
          if (res.ok) {
            setView((await res.json()) as ReponseTrajetFamille);
            setStale(false);
          } else setStale(true);
        } catch {
          setStale(true);
        }
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [visitId]);

  const enRoute = view.etat === "EN_ROUTE" && view.position;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p aria-live="polite" className="font-display text-[24px] leading-[1.2] tracking-[-.015em] text-balance">
          {tripHeadline(view)}
        </p>
        {stale ? <p className="text-[15px] text-muted">Connexion difficile : nouvelle tentative dans quelques secondes.</p> : null}
      </Card>

      <TripMapClient
        caregiver={view.accompagnant.prenom}
        home={{ latitude: view.domicile.latitude, longitude: view.domicile.longitude, approximate: view.domicile.approximatif }}
        position={enRoute ? { latitude: view.position!.latitude, longitude: view.position!.longitude, accuracy: view.position!.precisionMetres } : null}
        label={
          enRoute
            ? `Carte : le domicile et la position approximative de ${view.accompagnant.prenom}. Détails ci-dessous.`
            : "Carte : le domicile. Détails ci-dessous."
        }
      />

      <Card as="section" aria-label="Détails du trajet">
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-[1.45]">
          <li className="flex gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
            <span>
              Heure prévue : <ZonedTime start={view.heurePrevue} territoire={view.territoire} />
            </span>
          </li>
          {enRoute ? (
            <>
              <li className="flex gap-3">
                <Navigation aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
                <span>
                  Distance jusqu&apos;au domicile : environ {distanceLabel(view.distanceMetres ?? 0)} ({view.minutesEstimees ?? 1} min estimées).
                </span>
              </li>
              <li className="flex gap-3">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
                <span>
                  Position mise à jour à <ZonedTime start={view.position!.majA} territoire={view.territoire} />, précise à environ {view.position!.precisionMetres} m.
                </span>
              </li>
            </>
          ) : null}
          <li className="flex gap-3">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
            <span>{view.domicile.approximatif ? "Domicile : position approximative (centre de la commune)." : "Domicile : adresse enregistrée."}</span>
          </li>
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-[15px] text-muted">
          La position est arrondie et visible seulement pendant le trajet. Elle n&apos;est pas gardée.
        </p>
      </Card>
    </div>
  );
}
