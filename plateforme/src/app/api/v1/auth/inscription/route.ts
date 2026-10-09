import type { NextRequest } from "next/server";
import { demandeInscriptionSchema, type ReponseInscription } from "@/contracts/v1/inscription";
import { registerAccount } from "@/server/auth/registration";
import { logAudit } from "@/server/audit";
import { ApiError, enforceRateLimits, ipOf, json, readBody, route } from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/inscription — création d'un compte ACCOMPAGNANT depuis l'app (L2, contrat § 2.1, R6).
 * Réponse : 201 { etat: "VERIFICATION_EMAIL_ENVOYEE" }, la MÊME si l'e-mail existe déjà (aucune fuite).
 * Erreurs : 400 (corps refusé), 422 ACTION_IMPOSSIBLE (mot de passe trop courant, moins de 18 ans, commune inconnue,
 * T1 : territoire pas encore ouvert ou commune hors du territoire),
 * 429 (5 inscriptions par heure et par IP). L'inscription est gratuite pour l'accompagnant (R6, J27).
 */
export const POST = route(async (req: NextRequest) => {
  const body = await readBody(req, demandeInscriptionSchema);
  try {
    await enforceRateLimits([["inscription:ip", ipOf(req)]]);
  } catch (e) {
    if (e instanceof ApiError) await logAudit({ action: "auth.register_rate_limited", entityType: "User" });
    throw e;
  }
  const r = await registerAccount({
    role: body.role,
    firstName: body.prenom,
    lastName: body.nom,
    email: body.email,
    password: body.motDePasse,
    phone: body.telephone,
    commune: body.commune,
    territoire: body.territoire ?? null,
    location: null,
    city: null,
    birthDate: body.dateNaissance,
    newsOptIn: body.accepteInfos === true,
    via: "api",
  });
  if (!r.ok) throw new ApiError("ACTION_IMPOSSIBLE", r.message);
  return json<ReponseInscription>({ etat: "VERIFICATION_EMAIL_ENVOYEE" }, 201);
});
