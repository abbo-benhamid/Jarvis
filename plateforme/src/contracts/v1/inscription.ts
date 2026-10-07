/**
 * Contrat API v1 — création de compte et mot de passe oublié (lot L1-A, arbitrage § 2.1, décisions R6).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * - POST /api/v1/auth/inscription       → 201 { etat: "VERIFICATION_EMAIL_ENVOYEE" }, MÊME réponse si l'e-mail existe déjà.
 * - POST /api/v1/auth/mot-de-passe-oublie → 202 {} toujours (aucune fuite d'existence de compte).
 *
 * R6 (J25) : les CGU sont une case (`accepteCgu: true`). La politique de confidentialité est un LIEN à lire,
 * pas une case : l'app l'affiche à côté du bouton « Créer mon compte ».
 * R6 (J26) : date de naissance obligatoire. Le serveur refuse sous 18 ans.
 * Le serveur refuse aussi un mot de passe trop courant (422 ACTION_IMPOSSIBLE, message affichable).
 */
import { z } from "zod";

/** Longueur minimale du mot de passe (le serveur applique aussi une liste de refus). */
export const MOT_DE_PASSE_MIN = 10;
export const MOT_DE_PASSE_MAX = 128;

export const motDePasseSchema = z.string().min(MOT_DE_PASSE_MIN).max(MOT_DE_PASSE_MAX);

/** Téléphone : chiffres, espaces, +, points, tirets (ex. +596 696 12 34 56). */
export const telephoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .-]{6,20}$/);

/** Date au format AAAA-MM-JJ. */
export const dateJourSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const demandeInscriptionSchema = z
  .object({
    /** L'app est réservée aux accompagnants (ADR 0008). Une famille s'inscrit sur le site web. */
    role: z.literal("ACCOMPAGNANT"),
    prenom: z.string().trim().min(1).max(80),
    nom: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    telephone: telephoneSchema,
    motDePasse: motDePasseSchema,
    /** Code de commune (ex. "FORT_DE_FRANCE"), contrôlé par le serveur. */
    commune: z.string().trim().min(2).max(60).regex(/^[A-Z_]+$/),
    /** Date de naissance (AAAA-MM-JJ). 18 ans minimum. */
    dateNaissance: dateJourSchema,
    /** Case « J'accepte les conditions d'utilisation » (obligatoire). */
    accepteCgu: z.literal(true),
    /** Case facultative : e-mails d'information de Koudmen. */
    accepteInfos: z.boolean().optional(),
  })
  .strict();
export type DemandeInscription = z.infer<typeof demandeInscriptionSchema>;

export const reponseInscriptionSchema = z.object({ etat: z.literal("VERIFICATION_EMAIL_ENVOYEE") }).strict();
export type ReponseInscription = z.infer<typeof reponseInscriptionSchema>;

export const demandeMotDePasseOublieSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();
export type DemandeMotDePasseOublie = z.infer<typeof demandeMotDePasseOublieSchema>;

export const reponseMotDePasseOublieSchema = z.object({}).strict();
export type ReponseMotDePasseOublie = z.infer<typeof reponseMotDePasseOublieSchema>;
