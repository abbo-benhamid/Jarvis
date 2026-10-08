import "server-only";
import type { Plan } from "@prisma/client";
import { db } from "@/server/db";
import { formatDate } from "@/lib/format";
import { CRENEAUX, creneauLabel, type SujetRappel } from "@/lib/rappel";
import type { CreneauOption } from "@/components/famille/callback-request";

/**
 * L1d (M4) : contexte du formulaire « Demander un appel » (numéro du compte, créneaux du jour, demandes ouvertes).
 * Les libellés des créneaux sont calculés ici (serveur) pour éviter un écart d'affichage à l'hydratation.
 */
export async function callbackContext(userId: string, now: Date = new Date()) {
  const [user, open] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    db.planActivationRequest.findMany({ where: { userId, status: "NOUVELLE" }, orderBy: { createdAt: "desc" }, select: { plan: true, aineId: true, createdAt: true } }),
  ]);
  const creneaux: CreneauOption[] = CRENEAUX.map((c) => ({ value: c, label: creneauLabel(c, now) }));
  /** Date de la demande ouverte pour ce sujet (et cet aîné), sinon null. */
  const pendingSince = (sujet: SujetRappel, aineId: string | null = null): string | null => {
    const plan: Plan | null = sujet === "QUESTION" ? null : sujet;
    const r = open.find((o) => o.plan === plan && o.aineId === aineId);
    return r ? formatDate(r.createdAt) : null;
  };
  const latest = open[0] ? { createdAt: formatDate(open[0].createdAt) } : null;
  return { phone: user?.phone ?? null, creneaux, pendingSince, latest };
}
