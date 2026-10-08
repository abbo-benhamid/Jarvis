"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

/**
 * L1-B (L7) : carte MapLibre GL JS + tuiles OpenFreeMap (sans clé). Chargée CÔTÉ CLIENT seulement (import dynamique).
 * - Le texte alternatif est la liste textuelle affichée SOUS la carte par la page (la carte est `aria-hidden`).
 * - `prefers-reduced-motion` : aucun déplacement animé de la vue.
 * - Sans WebGL ou sans réseau : la carte est remplacée par un message ; la liste textuelle reste.
 * - L1d (M8) : textes des contrôles en français (`locale`), boutons ≥ 44 px (globals.css), marqueurs posés
 *   SANS attendre les tuiles, et message « Carte indisponible » si la carte ne charge pas en 8 s.
 * [À VÉRIFIER] Conditions d'usage d'OpenFreeMap (usage gratuit, attribution OpenStreetMap affichée).
 */
export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/** L1d (M8) : textes de MapLibre en français (critère WCAG 3.1.2, langue des parties). */
export const MAP_LOCALE_FR: Record<string, string> = {
  "AttributionControl.MapFeedback": "Signaler une erreur sur la carte",
  "AttributionControl.ToggleAttribution": "Afficher ou masquer les sources de la carte",
  "CooperativeGesturesHandler.MacHelpText": "Utilisez ⌘ + défilement pour zoomer",
  "CooperativeGesturesHandler.MobileHelpText": "Utilisez deux doigts pour déplacer la carte",
  "CooperativeGesturesHandler.WindowsHelpText": "Utilisez Ctrl + défilement pour zoomer",
  "FullscreenControl.Enter": "Plein écran",
  "FullscreenControl.Exit": "Quitter le plein écran",
  "GeolocateControl.FindMyLocation": "Trouver ma position",
  "GeolocateControl.LocationNotAvailable": "Position indisponible",
  "LogoControl.Title": "Logo MapLibre",
  "Map.Title": "Carte du trajet",
  "Marker.Title": "Repère",
  "NavigationControl.ResetBearing": "Remettre le nord en haut",
  "NavigationControl.ZoomIn": "Zoomer",
  "NavigationControl.ZoomOut": "Dézoomer",
  "Popup.Close": "Fermer",
};

/** Délai au-delà duquel une carte sans tuiles est remplacée par le message (M8). */
export const MAP_LOAD_TIMEOUT_MS = 8_000;

export type TripMapProps = {
  home: { latitude: number; longitude: number; approximate: boolean };
  position?: { latitude: number; longitude: number; accuracy: number } | null;
  caregiver: string;
};

function markerElement(kind: "home" | "caregiver", title: string): HTMLElement {
  const el = document.createElement("div");
  el.title = title;
  el.setAttribute("aria-hidden", "true");
  el.className =
    kind === "home"
      ? "grid size-9 place-items-center rounded-full border-[3px] border-white bg-[var(--mer)] shadow-md"
      : "size-6 rounded-full border-[3px] border-white bg-[var(--soleil)] shadow-md";
  if (kind === "home") el.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>';
  return el;
}

export function TripMap({ home, position, caregiver }: TripMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const cgMarker = useRef<Marker | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Création de la carte (une fois).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        lib.current = maplibre;
        const m = new maplibre.Map({
          container: box.current,
          style: OPENFREEMAP_STYLE,
          center: [home.longitude, home.latitude],
          zoom: 13,
          attributionControl: { compact: true },
          cooperativeGestures: true,
          locale: MAP_LOCALE_FR,
        });
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        new maplibre.Marker({ element: markerElement("home", "Domicile") }).setLngLat([home.longitude, home.latitude]).addTo(m);
        m.on("error", () => undefined);
        // M8 : marqueurs et cadrage sans attendre les tuiles ; message si rien ne charge en 8 s.
        const timer = setTimeout(() => !cancelled && !m.loaded() && setTimedOut(true), MAP_LOAD_TIMEOUT_MS);
        m.once("load", () => {
          clearTimeout(timer);
          if (!cancelled) setTimedOut(false);
        });
        map.current = m;
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      cgMarker.current = null;
    };
    // La carte est recréée seulement si le domicile change.
  }, [home.latitude, home.longitude]);

  // Position de l'accompagnant (mise à jour toutes les 10 s par la page).
  useEffect(() => {
    const m = map.current;
    const maplibre = lib.current;
    if (!m || !maplibre || !ready) return;
    if (!position) {
      cgMarker.current?.remove();
      cgMarker.current = null;
      m.jumpTo({ center: [home.longitude, home.latitude], zoom: 13 });
      return;
    }
    const at: [number, number] = [position.longitude, position.latitude];
    if (!cgMarker.current) cgMarker.current = new maplibre.Marker({ element: markerElement("caregiver", caregiver) }).setLngLat(at).addTo(m);
    else cgMarker.current.setLngLat(at);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bounds = new maplibre.LngLatBounds(at, at).extend([home.longitude, home.latitude]);
    m.fitBounds(bounds, { padding: 56, maxZoom: 15, animate: !reduced, duration: reduced ? 0 : 600 });
  }, [position, ready, home.latitude, home.longitude, caregiver]);

  if (failed) {
    return (
      <div className="kd-map grid place-items-center p-6 text-center text-[15px] text-muted">
        La carte ne peut pas s&apos;afficher sur cet appareil. Les informations sont écrites ci-dessous.
      </div>
    );
  }
  // M8 : la carte n'est plus `aria-hidden` (ses boutons sont focalisables) ; ses textes sont en français.
  return (
    <div className="relative">
      <div ref={box} className="kd-map" data-testid="carte-trajet" />
      {timedOut ? (
        <p role="status" className="absolute inset-x-3 top-3 rounded-md bg-surface p-3 text-center text-[15px] font-semibold shadow-card">
          Carte indisponible. Les informations sont ci-dessous.
        </p>
      ) : null}
    </div>
  );
}
