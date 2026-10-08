import "server-only";
/**
 * L2b (B1) : SEULE fonction qui écrit l'état d'un élément de vérification (`VerificationItem.status`).
 * Un test (`transition.guard.test.ts`) interdit toute autre écriture d'état dans `src/`.
 *
 * 1. `canTransition(de, vers, acteur)` : la règle de l'étude § 6.2 (rules.ts). Refus → VerificationError.
 * 2. Mise à jour SOUS CONDITION (`updateMany where { id, status: <lu> }`) : une course (deux opérateurs, un
 *    webhook et un opérateur) ne passe pas ; le second reçoit « l'élément a changé ».
 * 3. `VALIDE` exige l'adaptateur qui valide (M7) : `validatedWith`. Tout autre état l'efface.
 */
import type { Prisma, VerificationStatus } from "@prisma/client";
import type { DbClient } from "@/server/db";
import { VerificationError } from "./errors";
import { canTransition, type TransitionActor } from "./rules";

/** Qui a mis VALIDE (M7). « operateur » : revue humaine (liste de cases, appel, visio). */
export type ValidationAdapter = "simule" | "brevo" | "twilio" | "veriff" | "stripe" | "recherche-entreprises" | "insee" | "operateur";

export type ItemRef = { id: string; status: VerificationStatus };

export type TransitionOptions = {
  /** Autres colonnes (jamais `status` ni `validatedWith`). */
  data?: Omit<Prisma.VerificationItemUncheckedUpdateManyInput, "id" | "caregiverId" | "type" | "status" | "validatedWith">;
  /** Obligatoire pour VALIDE. */
  validatedWith?: ValidationAdapter;
  /** Conditions en plus (ex. refus proposé par la personne lue). */
  where?: Omit<Prisma.VerificationItemWhereInput, "id" | "status">;
};

export function transitionRefusedMessage(from: VerificationStatus): string {
  if (from === "REFUSE") return "Ce point est refusé après une revue à deux opérateurs. Seul un réexamen accepté le rouvre.";
  if (from === "A_REVOIR") return "L'équipe Koudmen relit déjà ce point. Vous n'avez rien à faire.";
  if (from === "VALIDE") return "Ce point est déjà vérifié.";
  return "Ce point ne peut pas changer maintenant.";
}

export async function writeItemStatus(client: DbClient, item: ItemRef, to: VerificationStatus, by: TransitionActor, opts: TransitionOptions = {}): Promise<void> {
  if (!canTransition(item.status, to, by)) throw new VerificationError(transitionRefusedMessage(item.status), item.status === "VALIDE" ? "DEJA_VALIDE" : "ACTION_IMPOSSIBLE");
  if (to === "VALIDE" && !opts.validatedWith) throw new Error("writeItemStatus : VALIDE exige validatedWith (L2b M7).");
  const res = await client.verificationItem.updateMany({
    where: { ...opts.where, id: item.id, status: item.status },
    data: { ...opts.data, status: to, validatedWith: to === "VALIDE" ? opts.validatedWith! : null },
  });
  if (res.count !== 1) throw new VerificationError("Ce point a changé entre-temps. Rechargez la page, puis réessayez.", "CONFLIT");
}
