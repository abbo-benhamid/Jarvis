/**
 * Contrat API v1 — GET /api/v1/me : le compte connecté.
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 * RGPD : liste FERMÉE de champs (`.strict()`). Aucune donnée de santé, aucun téléphone, aucun aîné.
 */
import { z } from "zod";
import { territoireSchema } from "./territoires";

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
    /** L1 : adresse e-mail confirmée (lien reçu, ou opérateur). */
    emailVerifie: z.boolean(),
    /**
     * L2 : profil validé par l'opérateur. Accompagnant : validation « Validé ». Famille et opérateur : toujours vrai.
     * Faux → l'app affiche « Profil en cours de validation ».
     */
    profilValide: z.boolean(),
    /**
     * R1 : le service est en préinscription (données réelles des aînés fermées : pas de fiche aîné, de QR,
     * de Kayé ni de trajet). Vrai seulement en mode lancement sans DONNEES_REELLES_AUTORISEES.
     */
    preinscription: z.boolean(),
    /**
     * T1 : territoire du compte. Accompagnant : territoire de sa zone d'intervention (null avant le choix).
     * Famille : territoire du premier aîné, sinon null. Opérateur : null.
     * L'app l'utilise pour le fuseau par défaut et la liste des communes.
     */
    territoire: territoireSchema.nullable(),
  })
  .strict();
export type ReponseMoi = z.infer<typeof reponseMoiSchema>;
