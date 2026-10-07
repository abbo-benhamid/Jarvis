"use client";

import dynamic from "next/dynamic";

/**
 * Carte chargée côté client seulement (`ssr: false`) : MapLibre a besoin de `window` et de WebGL.
 * `label` : texte alternatif lu par les lecteurs d'écran (la carte elle-même est masquée pour eux).
 */
const TripMap = dynamic(() => import("./trip-map").then((m) => m.TripMap), {
  ssr: false,
  loading: () => <div className="kd-map" aria-hidden="true" />,
});

export function TripMapClient({
  label,
  caregiver,
  home,
  position,
}: {
  label: string;
  caregiver: string;
  home: { latitude: number; longitude: number; approximate: boolean };
  position?: { latitude: number; longitude: number; accuracy: number } | null;
}) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <TripMap caregiver={caregiver} home={home} position={position ?? null} />
      <figcaption className="text-[15px] text-muted">{label}</figcaption>
    </figure>
  );
}
