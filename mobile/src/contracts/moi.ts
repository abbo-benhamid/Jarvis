// GÉNÉRÉ par mobile/scripts/sync-contracts.mjs depuis plateforme/src/contracts/v1. Ne pas modifier ici.
/**
 * Contrat API v1 — GET /api/v1/me : le compte connecté.
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 * RGPD : liste FERMÉE de champs (`.strict()`). Aucune donnée de santé, aucun téléphone, aucun aîné.
 */
import { z } from "zod";

export const roleSchema = z.enum(["FAMILLE", "ACCOMPAGNANT", "OPERATEUR"]);
export type Role = z.infer<typeof roleSchema>;

export const reponseMoiSchema = z
  .object({
    id: z.string().min(1),
    role: roleSchema,
    prenom: z.string(),
    nom: z.string(),
    email: z.string().email(),
    /** Compte de démonstration partagé. */
    demo: z.boolean(),
    /** Compte de test isolé (bac à sable). L'app affiche le bandeau « Version de test ». */
    bacASable: z.boolean(),
  })
  .strict();
export type ReponseMoi = z.infer<typeof reponseMoiSchema>;
