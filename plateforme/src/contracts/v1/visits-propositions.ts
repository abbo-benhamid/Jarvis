/**
 * Contrat API v1 — propositions de mission à l'accompagnant (lot A2, ADR 0008).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * Routes :
 * - GET  /api/v1/propositions               → propositions en attente.
 * - POST /api/v1/propositions/:id/accepter  → accepte : mission + visites des 4 semaines.
 * - POST /api/v1/propositions/:id/refuser   → refuse, SANS PÉNALITÉ (RM-05, anti-requalification).
 *
 * Anti-requalification (directive UE 2024/2831) : un refus n'a AUCUN effet sur le profil
 * (pas de compteur, pas de baisse de visibilité). La note de refus est facultative et n'est jamais transmise à la famille.
 */
import { z } from "zod";
import { dateIsoSchema, frequenceSchema, identifiantSchema } from "./visits";
import { territoireSchema } from "./territoires";

export const creneauSchema = z.enum(["MATIN", "APRES_MIDI", "SOIR"]);

export const propositionSchema = z
  .object({
    id: identifiantSchema,
    /** Message de l'équipe Koudmen (facultatif). */
    message: z.string().nullable(),
    creeLe: dateIsoSchema,
    /** T1 (T4) : fuseau IANA du territoire de l'aîné. Les créneaux (MATIN 9 h, APRES_MIDI 14 h, SOIR 18 h) sont dans CE fuseau. */
    fuseau: z.string(),
    aine: z
      .object({
        prenom: z.string(),
        /** T1 : toujours le territoire de l'accompagnant (matching dans le même territoire). */
        territoire: territoireSchema,
        commune: z.string(),
        communeLibelle: z.string(),
      })
      .strict(),
    demande: z
      .object({
        niveau: z.number().int().min(1).max(4),
        frequence: frequenceSchema,
        dureeMinutes: z.number().int().positive(),
        /** Date de début souhaitée (null : dès que possible). */
        debut: dateIsoSchema.nullable(),
        consignes: z.string().nullable(),
        /** 0 = lundi … 6 = dimanche. */
        creneaux: z.array(z.object({ jour: z.number().int().min(0).max(6), creneau: creneauSchema }).strict()),
      })
      .strict(),
    /** Nombre de visites créées si l'accompagnant accepte (4 semaines). */
    visitesPrevues: z.number().int().min(0),
  })
  .strict();
export type Proposition = z.infer<typeof propositionSchema>;

export const reponsePropositionsSchema = z
  .object({
    propositions: z.array(propositionSchema),
  })
  .strict();
export type ReponsePropositions = z.infer<typeof reponsePropositionsSchema>;

/** POST /propositions/:id/accepter : corps vide ou `{}`. */
export const demandeAcceptationSchema = z.object({}).strict();

export const reponseAcceptationSchema = z
  .object({
    statut: z.literal("ACCEPTEE"),
    missionId: identifiantSchema,
    /** Visites créées (4 semaines). */
    visitesCreees: z.number().int().min(0),
  })
  .strict();
export type ReponseAcceptation = z.infer<typeof reponseAcceptationSchema>;

/** POST /propositions/:id/refuser : note FACULTATIVE (jamais transmise à la famille). Corps vide accepté. */
export const demandeRefusSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type DemandeRefus = z.infer<typeof demandeRefusSchema>;

export const reponseRefusSchema = z
  .object({
    statut: z.literal("REFUSEE"),
    /** Toujours vrai : un refus n'a aucun effet sur le profil ni sur les propositions futures. */
    sansPenalite: z.literal(true),
  })
  .strict();
export type ReponseRefus = z.infer<typeof reponseRefusSchema>;
