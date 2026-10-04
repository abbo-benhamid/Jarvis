"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Mesure des pages vues (D15). Envoie seulement le chemin de la page (sans paramètres).
 * Aucun cookie de mesure, aucun outil tiers. Le serveur garde l'événement pour les testeurs.
 */
export function UsageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ path: pathname });
    try {
      void fetch("/api/evenements", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
    } catch {
      // La mesure ne doit jamais casser la page.
    }
  }, [pathname]);
  return null;
}
