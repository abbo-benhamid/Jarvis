"use client";

import { useEffect, useState } from "react";
import { hourIn } from "@/lib/fuseau";
import { TERRITOIRE_LANCEMENT, territoire as territoireDe, type CodeTerritoire } from "@/lib/territoires";

export { hourIn };

/**
 * L1d (M9, m7) et T1 (T4) : une heure de visite dit TOUJOURS son fuseau, celui du territoire de l'aîné.
 * - Rendu serveur (et sans JavaScript) : « 9 h 30, heure de Guadeloupe ».
 * - Après le chargement, si le lecteur n'a pas la même heure : « 9 h 30, heure de Guadeloupe (15 h 30 à Paris) ».
 * Format unique « 9 h 30 » (jamais « 09:30 »).
 */

function range(start: Date, end: Date | null, tz: string): string {
  return end ? `${hourIn(start, tz)} – ${hourIn(end, tz)}` : hourIn(start, tz);
}

/** Libellé du lieu du lecteur, à partir de son fuseau. */
export function readerPlace(tz: string): string {
  if (tz === "Europe/Paris") return "à Paris";
  if (tz === "America/Guadeloupe") return "en Guadeloupe";
  if (tz === "America/Martinique") return "en Martinique";
  if (tz === "America/Cayenne") return "en Guyane";
  if (tz === "Indian/Reunion") return "à La Réunion";
  return "chez vous";
}

export function ZonedTime({
  start,
  end,
  className,
  territoire = TERRITOIRE_LANCEMENT,
}: {
  start: Date | string;
  end?: Date | string | null;
  className?: string;
  /** Territoire de l'aîné (fuseau de la visite). Par défaut : territoire de lancement. */
  territoire?: CodeTerritoire;
}) {
  const t = territoireDe(territoire);
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const here = range(s, e, t.fuseau);
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    let tz = t.fuseau;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || t.fuseau;
    } catch {
      /* fuseau inconnu : heure du territoire seule */
    }
    const l = range(s, e, tz);
    setLocal(l !== here ? `${l} ${readerPlace(tz)}` : null);
    // s et e sont dérivés de start et end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(start), String(end ?? ""), here, t.fuseau]);

  return (
    <span className={className}>
      {here}, {t.libelleHeure}
      {local ? ` (${local})` : ""}
    </span>
  );
}
