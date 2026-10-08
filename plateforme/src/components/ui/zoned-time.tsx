"use client";

import { useEffect, useState } from "react";
import { MARTINIQUE_TZ } from "@/lib/format";

/**
 * L1d (M9, m7) : une heure de visite dit TOUJOURS son fuseau.
 * - Rendu serveur (et sans JavaScript) : « 9 h 30, heure de Martinique ».
 * - Après le chargement, si le lecteur n'est pas à l'heure de la Martinique : « 9 h 30, heure de Martinique (15 h 30 à Paris) ».
 * Format unique « 9 h 30 » (jamais « 09:30 »).
 */

export function hourIn(d: Date, timeZone: string): string {
  const [h, m] = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(d).split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

function range(start: Date, end: Date | null, tz: string): string {
  return end ? `${hourIn(start, tz)} – ${hourIn(end, tz)}` : hourIn(start, tz);
}

/** Libellé du lieu du lecteur, à partir de son fuseau. */
export function readerPlace(tz: string): string {
  if (tz === "Europe/Paris") return "à Paris";
  if (tz === "America/Guadeloupe") return "en Guadeloupe";
  if (tz === "America/Cayenne") return "en Guyane";
  if (tz === "Indian/Reunion") return "à La Réunion";
  return "chez vous";
}

export function ZonedTime({ start, end, className }: { start: Date | string; end?: Date | string | null; className?: string }) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const mq = range(s, e, MARTINIQUE_TZ);
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    let tz = MARTINIQUE_TZ;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || MARTINIQUE_TZ;
    } catch {
      /* fuseau inconnu : heure de Martinique seule */
    }
    const l = range(s, e, tz);
    setLocal(l !== mq ? `${l} ${readerPlace(tz)}` : null);
    // s et e sont dérivés de start et end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(start), String(end ?? ""), mq]);

  return (
    <span className={className}>
      {mq}, heure de Martinique{local ? ` (${local})` : ""}
    </span>
  );
}
