// GÉNÉRÉ par mobile/scripts/sync-contracts.mjs depuis plateforme/src/contracts/v1. Ne pas modifier ici.
/**
 * Contrat API v1 — authentification par jeton (app mobile, ADR 0008 § 4.5).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * Flux :
 * 1. POST /api/v1/auth/code    → l'app prouve l'identité et reçoit un code à usage unique (2 min).
 * 2. POST /api/v1/auth/token   → l'app échange le code + le vérificateur PKCE contre les jetons.
 * 3. POST /api/v1/auth/refresh → rotation : nouveau couple de jetons ; l'ancien jeton de renouvellement meurt.
 * 4. POST /api/v1/auth/logout  → révoque la connexion de l'appareil (ou toutes les connexions).
 */
import { z } from "zod";

/** Durée de vie du jeton d'accès (secondes) : 15 minutes. */
export const DUREE_JETON_ACCES_S = 15 * 60;
/** Durée de vie du jeton de renouvellement (secondes) : 30 jours, renouvelée à chaque rotation. */
export const DUREE_JETON_RENOUVELLEMENT_S = 30 * 24 * 60 * 60;
/** Durée de vie du code de connexion (secondes) : 2 minutes. */
export const DUREE_CODE_S = 2 * 60;

/** PKCE (RFC 7636) : base64url sans remplissage. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Vérificateur PKCE : 43 à 128 caractères aléatoires, gardé sur l'appareil. */
export const codeVerifierSchema = z.string().min(43).max(128).regex(BASE64URL, "Format base64url attendu.");
/** Défi PKCE : SHA-256 du vérificateur, en base64url (43 caractères). Méthode S256 seulement. */
export const codeChallengeSchema = z.string().length(43).regex(BASE64URL, "Format base64url attendu.");

/** Jeton de renouvellement : opaque (préfixe + 43 caractères base64url). */
export const jetonRenouvellementSchema = z.string().min(20).max(200);

// ─────────────── POST /auth/code ───────────────

export const demandeCodeMotDePasseSchema = z
  .object({
    methode: z.literal("mot_de_passe"),
    email: z.string().trim().toLowerCase().email().max(254),
    motDePasse: z.string().min(1).max(200),
    codeChallenge: codeChallengeSchema,
  })
  .strict();

/** Mode démo seulement (DEMO_MODE=true) : compte de démonstration partagé. Jamais d'opérateur. */
export const demandeCodeDemoSchema = z
  .object({
    methode: z.literal("demo"),
    role: z.enum(["ACCOMPAGNANT", "FAMILLE"]),
    codeChallenge: codeChallengeSchema,
  })
  .strict();

export const demandeCodeSchema = z.discriminatedUnion("methode", [demandeCodeMotDePasseSchema, demandeCodeDemoSchema]);
export type DemandeCode = z.infer<typeof demandeCodeSchema>;

export const reponseCodeSchema = z
  .object({
    /** Code opaque à usage unique. */
    code: z.string().min(20).max(2000),
    /** Secondes avant expiration. */
    expireDans: z.number().int().positive(),
  })
  .strict();
export type ReponseCode = z.infer<typeof reponseCodeSchema>;

// ─────────────── POST /auth/token ───────────────

export const demandeJetonSchema = z
  .object({
    code: z.string().min(20).max(2000),
    codeVerifier: codeVerifierSchema,
  })
  .strict();
export type DemandeJeton = z.infer<typeof demandeJetonSchema>;

/** Réponse commune à /auth/token et /auth/refresh. */
export const reponseJetonsSchema = z
  .object({
    typeJeton: z.literal("Bearer"),
    /** À envoyer dans `Authorization: Bearer …`. Garder en mémoire seulement. */
    jetonAcces: z.string().min(20).max(2000),
    /** Secondes avant expiration du jeton d'accès. */
    expireDans: z.number().int().positive(),
    /** À garder dans le stockage sécurisé de l'appareil (expo-secure-store). Usage unique. */
    jetonRenouvellement: jetonRenouvellementSchema,
    /** Secondes avant expiration du jeton de renouvellement. */
    renouvellementExpireDans: z.number().int().positive(),
  })
  .strict();
export type ReponseJetons = z.infer<typeof reponseJetonsSchema>;

// ─────────────── POST /auth/refresh ───────────────

export const demandeRenouvellementSchema = z
  .object({
    jetonRenouvellement: jetonRenouvellementSchema,
  })
  .strict();
export type DemandeRenouvellement = z.infer<typeof demandeRenouvellementSchema>;

// ─────────────── POST /auth/logout ───────────────

/**
 * Jeton d'accès (en-tête `Authorization`) et/ou jeton de renouvellement (corps). Un des deux suffit.
 * `partout: true` ferme aussi toutes les autres connexions du compte (web compris).
 * Réponse : 204 sans corps, même si le jeton est déjà révoqué (déconnexion idempotente).
 */
export const demandeDeconnexionSchema = z
  .object({
    jetonRenouvellement: jetonRenouvellementSchema.optional(),
    partout: z.boolean().optional(),
  })
  .strict();
export type DemandeDeconnexion = z.infer<typeof demandeDeconnexionSchema>;
