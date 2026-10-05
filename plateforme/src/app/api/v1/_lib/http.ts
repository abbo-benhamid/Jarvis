import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { STATUT_HTTP, type CodeErreur, type ReponseErreur } from "@/contracts/v1/erreurs";
import { clientIpFrom, hitRateLimits, retryMessage, type RateRuleName } from "@/server/rate-limit";
import { authenticateAccessToken, type ApiPrincipal } from "@/server/auth/token-service";
import { bearerToken } from "@/server/auth/token";

/**
 * Outils communs des routes /api/v1 (dossier privé `_lib` : jamais routé par Next.js).
 * - Format d'erreur UNIQUE : { erreur: { code, message } }.
 * - Aucune réponse n'est mise en cache (jetons, données personnelles).
 * - Aucun détail technique dans une erreur 500.
 */

/** Taille maximale d'un corps JSON (octets). */
export const MAX_BODY_BYTES = 16 * 1024;

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export function apiError(code: CodeErreur, message: string, headers: Record<string, string> = {}): NextResponse {
  const body: ReponseErreur = { erreur: { code, message } };
  const extra: Record<string, string> = { ...headers };
  if (STATUT_HTTP[code] === 401) extra["WWW-Authenticate"] = 'Bearer realm="koudmen"';
  return NextResponse.json(body, { status: STATUT_HTTP[code], headers: { ...NO_STORE, ...extra } });
}

/** Erreur levée dans une route : convertie en réponse au format unique par `route()`. */
export class ApiError extends Error {
  constructor(
    readonly code: CodeErreur,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Handler = (req: NextRequest) => Promise<Response>;

/** Enveloppe d'une route : convertit ApiError, et masque toute autre erreur (500 sans détail). */
export function route(fn: Handler): Handler {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof ApiError) return apiError(e.code, e.message, e.headers);
      // Journal serveur : nom de l'erreur seulement (pas de donnée personnelle, pas de jeton).
      console.error(`[api/v1] ${req.method} ${req.nextUrl.pathname} : ${e instanceof Error ? e.name : "erreur"}`);
      return apiError("ERREUR_INTERNE", "Une erreur est survenue. Réessayez dans un instant.");
    }
  };
}

/**
 * Lit et valide le corps JSON. Corps vide accepté si `allowEmpty` (traité comme `{}`).
 * Erreurs : 413 si trop gros, 400 si JSON invalide ou refusé par le schéma.
 */
export async function readBody<S extends z.ZodTypeAny>(req: NextRequest, schema: S, opts: { allowEmpty?: boolean } = {}): Promise<z.infer<S>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new ApiError("REQUETE_TROP_GROSSE", "La requête est trop grosse.");
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new ApiError("REQUETE_TROP_GROSSE", "La requête est trop grosse.");
  let raw: unknown = {};
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError("REQUETE_INVALIDE", "Le corps de la requête n'est pas du JSON valide.");
    }
  } else if (!opts.allowEmpty) {
    throw new ApiError("REQUETE_INVALIDE", "Le corps de la requête est vide.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Noms des champs seulement : jamais la valeur reçue (mot de passe, jeton).
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "corps"))].slice(0, 5).join(", ");
    throw new ApiError("REQUETE_INVALIDE", `Champs refusés : ${fields}.`);
  }
  return parsed.data;
}

/**
 * Limites de débit (règles existantes de src/server/rate-limit-rules.ts).
 * Le sujet peut être préfixé (« api-v1-refresh:<ip> ») pour garder un compteur séparé avec la même règle.
 */
export async function enforceRateLimits(checks: [RateRuleName, string][]): Promise<void> {
  const r = await hitRateLimits(checks);
  if (!r.allowed) {
    throw new ApiError("TROP_DE_REQUETES", retryMessage(r.retryAfterSeconds), { "Retry-After": String(r.retryAfterSeconds) });
  }
}

export function ipOf(req: NextRequest): string {
  return clientIpFrom(req.headers);
}

/** Exige un jeton d'accès valide (`Authorization: Bearer …`). Sinon : 401 NON_AUTHENTIFIE. */
export async function requireBearer(req: NextRequest): Promise<ApiPrincipal> {
  const principal = await authenticateAccessToken(bearerToken(req.headers.get("authorization")));
  if (!principal) throw new ApiError("NON_AUTHENTIFIE", "Votre session a expiré. Reconnectez-vous.");
  return principal;
}
