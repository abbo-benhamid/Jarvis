/**
 * Contrat API v1 — trajet en direct de l'accompagnant (lot L1-B, décisions L6 et R4).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * Routes (Bearer accompagnant) :
 * - POST /api/v1/visites/:id/trajet   `{ action: "DEMARRER" | "ARRETER" }` → `{ trajet: { etat, expireA } }`
 * - POST /api/v1/visites/:id/position `{ latitude, longitude, precisionMetres, survenuA, simulee? }` → 204 ;
 *   409 CONFLIT si aucun trajet en cours ; 429 si moins de 30 s depuis la position précédente.
 *
 * Règles (R4) : l'accompagnant démarre LUI-MÊME le partage. Arrêt automatique au check-in, à « ARRETER »,
 * à moins de 150 m du domicile, ou après 60 min. Aucune position gardée après le trajet, aucun historique.
 * Coordonnées arrondies à ~110 m (3 décimales). Départ masqué : rien n'est montré à moins de 500 m du point de départ.
 */
import { z } from "zod";
import { dateIsoSchema } from "./visits";

/** Durée maximale d'un trajet (minutes). */
export const TRAJET_DUREE_MAX_MIN = 60;
/** Intervalle minimal entre deux positions (secondes). */
export const TRAJET_INTERVALLE_POSITION_S = 30;

export const demandeTrajetSchema = z
  .object({
    action: z.enum(["DEMARRER", "ARRETER"]),
  })
  .strict();
export type DemandeTrajet = z.infer<typeof demandeTrajetSchema>;

export const reponseTrajetSchema = z
  .object({
    trajet: z
      .object({
        etat: z.enum(["EN_COURS", "ARRETE"]),
        /** Fin automatique du partage (null si le trajet est arrêté). */
        expireA: dateIsoSchema.nullable(),
      })
      .strict(),
    /**
     * Domicile de l'aîné pour la carte d'itinéraire de l'app (DEMARRER seulement), arrondi à 3 décimales.
     * Code m6 (L1d) : toujours présent dans la réponse à DEMARRER (sans accord de l'aîné, DEMARRER est refusé avant),
     * absent dans la réponse à ARRETER. `approximatif` : centre de la commune.
     */
    domicile: z
      .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), approximatif: z.boolean() })
      .strict()
      .optional(),
  })
  .strict();
export type ReponseTrajet = z.infer<typeof reponseTrajetSchema>;

/** Position pendant un trajet démarré. `simulee: true` (position fictive du téléphone) : reçue mais jamais montrée. */
export const demandePositionSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precisionMetres: z.number().min(0).max(100_000),
    /** Heure de la lecture sur l'appareil. */
    survenuA: dateIsoSchema,
    simulee: z.boolean().optional(),
  })
  .strict();
export type DemandePosition = z.infer<typeof demandePositionSchema>;

// ─────────────── Vue famille (route web, cookie) : GET /api/famille/visites/:id/trajet ───────────────

/**
 * - EN_ROUTE : l'accompagnant partage son trajet et a quitté son point de départ (> 500 m) ;
 * - PREVUE : hors trajet (ou départ masqué) — la famille voit seulement l'heure prévue (R4 : jamais « non partagé ») ;
 * - COMMENCEE : le check-in est fait ;
 * - TERMINEE : le check-out est fait, ou la visite est close.
 */
export const etatTrajetFamilleSchema = z.enum(["EN_ROUTE", "PREVUE", "COMMENCEE", "TERMINEE"]);
export type EtatTrajetFamille = z.infer<typeof etatTrajetFamilleSchema>;

export const reponseTrajetFamilleSchema = z
  .object({
    etat: etatTrajetFamilleSchema,
    heurePrevue: dateIsoSchema,
    accompagnant: z.object({ prenom: z.string() }).strict(),
    position: z
      .object({ latitude: z.number(), longitude: z.number(), precisionMetres: z.number(), majA: dateIsoSchema })
      .strict()
      .optional(),
    domicile: z.object({ latitude: z.number(), longitude: z.number(), approximatif: z.boolean() }).strict(),
    distanceMetres: z.number().int().nonnegative().optional(),
    minutesEstimees: z.number().int().nonnegative().optional(),
  })
  .strict();
export type ReponseTrajetFamille = z.infer<typeof reponseTrajetFamilleSchema>;
