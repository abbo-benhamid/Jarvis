/**
 * Contrat API v1 — appareils qui reçoivent les notifications push (lot N1).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * Routes :
 * - POST   /api/v1/appareils      → enregistre (ou rafraîchit) le jeton Expo de l'appareil.
 * - DELETE /api/v1/appareils/:id  → retire l'appareil (avant la déconnexion). Idempotent : 204.
 *
 * RGPD : le jeton n'identifie qu'un appareil. Il est lié à la connexion de l'app : une déconnexion coupe le push.
 * R9 : un push contient un titre générique et un écran à ouvrir, jamais une donnée de santé.
 */
import { z } from "zod";

/** Jeton Expo Push (`ExponentPushToken[…]` ou `ExpoPushToken[…]`). */
export const jetonPushSchema = z
  .string()
  .max(200)
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,100}\]$/, "Jeton Expo attendu.");

export const plateformeAppareilSchema = z.enum(["IOS", "ANDROID"]);
export type PlateformeAppareil = z.infer<typeof plateformeAppareilSchema>;

export const demandeAppareilSchema = z
  .object({
    jeton: jetonPushSchema,
    plateforme: plateformeAppareilSchema,
  })
  .strict();
export type DemandeAppareil = z.infer<typeof demandeAppareilSchema>;

export const reponseAppareilSchema = z
  .object({
    /** Identifiant à garder : sert à retirer l'appareil à la déconnexion. */
    id: z.string().min(1),
    enregistreA: z.string().datetime({ offset: true }),
  })
  .strict();
export type ReponseAppareil = z.infer<typeof reponseAppareilSchema>;

/** Écran ouvert au toucher d'un push (champ `ecran` des données du push). */
export const ecranPushSchema = z.enum(["propositions", "visite", "kaye", "visites"]);
export type EcranPush = z.infer<typeof ecranPushSchema>;

/** Données jointes à un push. L'app ignore un push dont les données sont hors contrat. */
export const donneesPushSchema = z.object({
  ecran: ecranPushSchema,
  visiteId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  lien: z.string().startsWith("/").max(200),
});
export type DonneesPush = z.infer<typeof donneesPushSchema>;
