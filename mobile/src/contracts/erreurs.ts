// GÉNÉRÉ par mobile/scripts/sync-contracts.mjs depuis plateforme/src/contracts/v1. Ne pas modifier ici.
/**
 * Contrat API v1 — format d'erreur UNIQUE.
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 */
import { z } from "zod";

/** Codes d'erreur stables. L'app décide de son comportement sur le code, jamais sur le message. */
export const CODES_ERREUR = [
  /** 400 : corps absent, JSON invalide ou champ refusé. */
  "REQUETE_INVALIDE",
  /** 401 : e-mail ou mot de passe incorrect (message identique si le compte n'existe pas). */
  "IDENTIFIANTS_INVALIDES",
  /** 401 : pas de jeton d'accès, jeton expiré ou révoqué. L'app tente /auth/refresh. */
  "NON_AUTHENTIFIE",
  /** 400 : code de connexion invalide, expiré, déjà utilisé, ou vérificateur PKCE faux. */
  "CODE_INVALIDE",
  /** 401 : jeton de renouvellement invalide, expiré ou révoqué. L'app renvoie vers la connexion. */
  "JETON_INVALIDE",
  /** 401 : jeton de renouvellement déjà utilisé. Toute la connexion de l'appareil est révoquée. */
  "JETON_REUTILISE",
  /** 403 : le compte ne peut pas utiliser l'API (rôle, compte démo hors démo, bac à sable). */
  "ACCES_REFUSE",
  /** 404 : ressource absente. */
  "INTROUVABLE",
  /** 409 : l'état a changé (proposition plus en attente, demande déjà pourvue). L'app recharge. */
  "CONFLIT",
  /** 413 : corps trop gros. */
  "REQUETE_TROP_GROSSE",
  /** 422 : requête valide, mais action impossible (profil non validé, tarif manquant…). Message affichable. */
  "ACTION_IMPOSSIBLE",
  /** 429 : trop d'essais. En-tête Retry-After en secondes. */
  "TROP_DE_REQUETES",
  /** 500 : erreur du serveur. Aucun détail technique. */
  "ERREUR_INTERNE",
] as const;

export const codeErreurSchema = z.enum(CODES_ERREUR);
export type CodeErreur = z.infer<typeof codeErreurSchema>;

/** Toute réponse d'erreur de l'API v1 : `{ erreur: { code, message } }`. */
export const reponseErreurSchema = z
  .object({
    erreur: z
      .object({
        code: codeErreurSchema,
        /** Message en français simple, affichable tel quel. */
        message: z.string().min(1).max(300),
      })
      .strict(),
  })
  .strict();
export type ReponseErreur = z.infer<typeof reponseErreurSchema>;

/** Statut HTTP de chaque code. */
export const STATUT_HTTP: Record<CodeErreur, number> = {
  REQUETE_INVALIDE: 400,
  IDENTIFIANTS_INVALIDES: 401,
  NON_AUTHENTIFIE: 401,
  CODE_INVALIDE: 400,
  JETON_INVALIDE: 401,
  JETON_REUTILISE: 401,
  ACCES_REFUSE: 403,
  INTROUVABLE: 404,
  CONFLIT: 409,
  REQUETE_TROP_GROSSE: 413,
  ACTION_IMPOSSIBLE: 422,
  TROP_DE_REQUETES: 429,
  ERREUR_INTERNE: 500,
};
