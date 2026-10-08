import type { NextRequest } from "next/server";
import { demandeSoumissionSchema, reponseSoumissionSchema } from "@/contracts/v1/verifications";
import { AccompagnantError, submitForReview } from "@/server/accompagnant/service";
import { db } from "@/server/db";
import { ApiError, json, readBody, route } from "../../../_lib/http";
import { run, verifActor } from "../../_lib/verif";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/accompagnant/verifications/soumettre — envoie le dossier à l'équipe (même service que le site).
 * Réponse : 200 `{ dossier: { etat: "EN_ATTENTE" } }`. Erreurs : 422 ELEMENTS_MANQUANTS (le message liste les éléments),
 * 409 CONFLIT (déjà envoyé).
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  await readBody(req, demandeSoumissionSchema, { allowEmpty: true });
  await run(async () => {
    try {
      await submitForReview(actor);
    } catch (e) {
      if (e instanceof AccompagnantError && e.code === "INVALIDE") throw new ApiError("ELEMENTS_MANQUANTS", e.message.slice(0, 300));
      throw e;
    }
  });
  const p = await db.caregiverProfile.findUniqueOrThrow({ where: { userId: actor.id }, select: { validation: true } });
  return json(reponseSoumissionSchema.parse({ dossier: { etat: p.validation } }));
});
