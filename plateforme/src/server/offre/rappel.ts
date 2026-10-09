import "server-only";
import type { Plan } from "@prisma/client";
import { db } from "@/server/db";
import { formatDate } from "@/lib/format";
import { CRENEAUX, creneauLabel, type Creneau, type SujetRappel } from "@/lib/rappel";
import type { CreneauOption } from "@/components/famille/callback-request";

/**
 * L1d (M4) : contexte du formulaire « Demander un appel » (numéro du compte, créneaux du jour, demandes ouvertes).
 * Les libellés des créneaux sont calculés ici (serveur) pour éviter un écart d'affichage à l'hydratation.
 */
export async function callbackContext(userId: string, now: Date = new Date()) {
  const [user, open] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    db.planActivationRequest.findMany({ where: { userId, status: "NOUVELLE" }, orderBy: { createdAt: "desc" }, select: { plan: true, aineId: true, createdAt: true, creneau: true } }),
  ]);
  const creneaux: CreneauOption[] = CRENEAUX.map((c) => ({ value: c, label: creneauLabel(c, now) }));
  /** Date de la demande ouverte pour ce sujet (et cet aîné), sinon null. */
  const pendingSince = (sujet: SujetRappel, aineId: string | null = null): string | null => {
    const plan: Plan | null = sujet === "QUESTION" ? null : sujet;
    const r = open.find((o) => o.plan === plan && o.aineId === aineId);
    return r ? formatDate(r.createdAt) : null;
  };
  // P1 : la demande la plus récente, avec son créneau (accueil famille en préinscription).
  const last = open[0];
  const latest = last
    ? {
        createdAt: formatDate(last.createdAt),
        creneau: last.creneau && (CRENEAUX as readonly string[]).includes(last.creneau) ? creneauLabel(last.creneau as Creneau, now) : null,
        sujet: (last.plan ?? "QUESTION") as SujetRappel,
      }
    : null;
  return { phone: user?.phone ?? null, creneaux, pendingSince, latest };
}
