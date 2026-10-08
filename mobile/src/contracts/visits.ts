// GÉNÉRÉ par mobile/scripts/sync-contracts.mjs depuis plateforme/src/contracts/v1. Ne pas modifier ici.
/**
 * Contrat API v1 — visites et événements de l'app accompagnant (lot A2, ADR 0008).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * Routes :
 * - GET  /api/v1/visites?jours=7 → visites de l'accompagnant connecté (cache hors ligne de l'app).
 * - GET  /api/v1/visites/:id     → une visite (avec le brouillon de Kayé synchronisé).
 * - POST /api/v1/evenements      → lot d'événements de la file hors ligne, idempotent par `clientEventId`.
 *
 * RGPD (ADR 0008 § 4.2) : listes FERMÉES de champs (`.strict()`). Jamais le code du domicile, jamais un téléphone,
 * jamais un besoin de santé, jamais le texte d'un Kayé publié.
 * Anti-requalification (§ 4.1) : une position PONCTUELLE au check-in seulement, avec l'accord explicite.
 * Aucune position au check-out, au Kayé ni au SOS.
 */
import { z } from "zod";

// ─────────────── Constantes ───────────────

/** Fenêtre par défaut de GET /visites (jours à venir). */
export const JOURS_VISITES_DEFAUT = 7;
/** Fenêtre maximale de GET /visites. */
export const JOURS_VISITES_MAX = 14;
/** Nombre d'événements au plus dans un lot. */
export const MAX_EVENEMENTS_PAR_LOT = 50;
/** Écart d'horloge (heures) entre l'appareil et le serveur au-delà duquel la visite passe « À vérifier ». */
export const ECART_HORLOGE_MAX_H = 12;
/** Nombre de facteurs de preuve valides pour valider une visite (2 sur 3). */
export const SEUIL_PREUVE = 2;

// ─────────────── Briques ───────────────

/** Date ISO 8601 avec fuseau (ex. « 2026-10-05T14:00:00.000Z » ou « …-04:00 »). */
export const dateIsoSchema = z.string().datetime({ offset: true });
/** Identifiant serveur (cuid). Une forme inattendue répond 404, comme un identifiant inconnu. */
export const identifiantSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

/**
 * L1d (D4) : PRESENCE_PROBABLE = carte du domicile (QR ou code) + position, SANS la confirmation de l'aîné.
 * La visite passe VALIDEE seulement avec la confirmation de l'aîné (ou de la famille employeur) ; la famille peut
 * contester pendant 48 h (la visite passe alors A_VERIFIER).
 */
export const statutVisiteSchema = z.enum(["PREVUE", "EN_COURS", "VALIDEE", "A_VERIFIER", "PRESENCE_PROBABLE"]);
export type StatutVisite = z.infer<typeof statutVisiteSchema>;

export const facteurPreuveSchema = z.enum(["GPS", "CODE_DOMICILE", "CONFIRMATION_AINE"]);
export type FacteurPreuve = z.infer<typeof facteurPreuveSchema>;

export const frequenceSchema = z.enum(["PONCTUELLE", "HEBDOMADAIRE", "DEUX_PAR_SEMAINE", "QUOTIDIENNE"]);
export const appetitSchema = z.enum(["BON", "MOYEN", "FAIBLE", "NON_OBSERVE"]);

// ─────────────── GET /visites ───────────────

/** Paramètres de requête de GET /visites. `jours` : 1 à 14, 7 par défaut. */
export const requeteVisitesSchema = z
  .object({
    jours: z.coerce.number().int().min(1).max(JOURS_VISITES_MAX).default(JOURS_VISITES_DEFAUT),
  })
  .strict();
export type RequeteVisites = z.infer<typeof requeteVisitesSchema>;

/** L'aîné, au minimum utile pour la visite. Adresse APPROXIMATIVE seulement (quartier, commune). */
export const aineVisiteSchema = z
  .object({
    prenom: z.string(),
    /** Initiale du nom (ex. « R. »). */
    initialeNom: z.string().nullable(),
    /** Code commune (ex. « FORT_DE_FRANCE »). */
    commune: z.string(),
    /** Nom affichable de la commune (ex. « Fort-de-France »). */
    communeLibelle: z.string(),
    /** Indication libre (quartier, repère). Jamais une adresse complète. */
    adresseApproximative: z.string().nullable(),
    /** Centres d'intérêt de l'aîné (sujets de conversation). Liste vide si la famille n'a rien indiqué. */
    interets: z.array(z.string()),
  })
  .strict();

/** La demande de la famille, telle que l'accompagnant l'a acceptée. */
export const demandeFamilleSchema = z
  .object({
    /** Niveau d'accompagnement 1 à 4. */
    niveau: z.number().int().min(1).max(4),
    frequence: frequenceSchema,
    dureeMinutes: z.number().int().positive(),
    /** Consignes écrites par la famille (habitudes, accès). Peut être null. */
    consignes: z.string().nullable(),
  })
  .strict();

/** État de la preuve « 2 facteurs sur 3 ». */
export const preuveVisiteSchema = z
  .object({
    score: z.number().int().min(0).max(3),
    seuil: z.literal(SEUIL_PREUVE),
    facteursValides: z.array(facteurPreuveSchema),
    checkInA: dateIsoSchema.nullable(),
    checkOutA: dateIsoSchema.nullable(),
    /** Un événement de l'app est arrivé avec un écart d'horloge > 12 h : la visite est « À vérifier ». */
    horlogeSuspecte: z.boolean(),
  })
  .strict();

/** Ce que l'accompagnant peut faire maintenant (calculé par le serveur ; l'app peut aussi décider hors ligne). */
export const actionsVisiteSchema = z
  .object({
    checkIn: z.boolean(),
    checkOut: z.boolean(),
    kaye: z.boolean(),
  })
  .strict();

export const visiteSchema = z
  .object({
    id: identifiantSchema,
    debut: dateIsoSchema,
    fin: dateIsoSchema,
    statut: statutVisiteSchema,
    aine: aineVisiteSchema,
    demande: demandeFamilleSchema,
    preuve: preuveVisiteSchema,
    /** Le Kayé de la visite est publié. Son texte n'est JAMAIS renvoyé à l'app (RGPD, ADR 0008 § 4.2). */
    kayePublie: z.boolean(),
    actions: actionsVisiteSchema,
  })
  .strict();
export type Visite = z.infer<typeof visiteSchema>;

export const reponseVisitesSchema = z
  .object({
    /** Heure du serveur (l'app peut mesurer l'écart avec son horloge). */
    genereA: dateIsoSchema,
    jours: z.number().int().min(1).max(JOURS_VISITES_MAX),
    visites: z.array(visiteSchema),
  })
  .strict();
export type ReponseVisites = z.infer<typeof reponseVisitesSchema>;

// ─────────────── Kayé ───────────────

/** Kayé publié : humeur, appétit, activités, note. Signal « à surveiller » NON médical. */
export const kayePublieSchema = z
  .object({
    /** 1 (très bas) à 5 (très bien). */
    humeur: z.number().int().min(1).max(5),
    appetit: appetitSchema,
    activites: z.array(z.string().trim().min(1).max(40)).max(10),
    note: z.string().trim().max(500).nullable().optional(),
    aSurveiller: z.boolean(),
    /** Obligatoire si `aSurveiller` est vrai. */
    noteSurveillance: z.string().trim().max(300).nullable().optional(),
  })
  .strict();
export type KayePublie = z.infer<typeof kayePublieSchema>;

/** Brouillon : mêmes champs, tous facultatifs. Le plus récent (heure de l'appareil) gagne. */
export const brouillonKayeSchema = z
  .object({
    humeur: z.number().int().min(1).max(5).optional(),
    appetit: appetitSchema.optional(),
    activites: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    aSurveiller: z.boolean().optional(),
    noteSurveillance: z.string().trim().max(300).nullable().optional(),
  })
  .strict();
export type BrouillonKaye = z.infer<typeof brouillonKayeSchema>;

// ─────────────── GET /visites/:id ───────────────

export const reponseVisiteSchema = visiteSchema
  .extend({
    /** Dernier brouillon synchronisé, tant que le Kayé n'est pas publié. Null sinon. */
    brouillonKaye: brouillonKayeSchema.nullable(),
  })
  .strict();
export type ReponseVisite = z.infer<typeof reponseVisiteSchema>;

// ─────────────── POST /evenements ───────────────

const evenementBase = {
  /** UUID créé par l'appareil. Un doublon (même compte, même identifiant) est ignoré. */
  clientEventId: z.string().uuid(),
  /** Heure de l'appareil au moment de l'action. */
  survenuA: dateIsoSchema,
};

/** Position PONCTUELLE (une lecture), avec l'accord explicite de l'accompagnant. */
export const positionPonctuelleSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precisionMetres: z.number().min(0).max(100_000).optional(),
    /** L'accompagnant a accepté cette lecture unique. Obligatoire. */
    consentement: z.literal(true),
    /** L1-B (L10) : le téléphone signale une position simulée (`mocked` Android). Refusée : preuve « À vérifier ». */
    simulee: z.boolean().optional(),
  })
  .strict();

/** L1-B (L9) : contenu du QR signé de la carte domicile (`koudmen:domicile:s1:<jeton>`) ou le jeton seul. */
export const QR_DOMICILE_MAX = 2000;

/** Check-in : QR signé, code du domicile et/ou position ponctuelle (au moins un des trois). */
export const evenementCheckInSchema = z
  .object({
    ...evenementBase,
    type: z.literal("CHECK_IN"),
    visiteId: identifiantSchema,
    /** Code affiché au domicile (6 caractères), ou lu dans le QR. Jamais enregistré ni journalisé. */
    codeDomicile: z.string().trim().min(1).max(12).optional(),
    /** L1-B (L9) : QR signé de la carte domicile. Prioritaire sur `codeDomicile`. Jamais enregistré ni journalisé. */
    qr: z.string().trim().min(1).max(QR_DOMICILE_MAX).optional(),
    position: positionPonctuelleSchema.optional(),
  })
  .strict();

/** Check-out : AUCUNE position (pas de suivi). */
export const evenementCheckOutSchema = z
  .object({ ...evenementBase, type: z.literal("CHECK_OUT"), visiteId: identifiantSchema })
  .strict();

export const evenementKayeBrouillonSchema = z
  .object({ ...evenementBase, type: z.literal("KAYE_BROUILLON"), visiteId: identifiantSchema, kaye: brouillonKayeSchema })
  .strict();

export const evenementKayePublicationSchema = z
  .object({ ...evenementBase, type: z.literal("KAYE_PUBLICATION"), visiteId: identifiantSchema, kaye: kayePublieSchema })
  .strict();

/** SOS : alerte l'équipe Koudmen. Visite facultative. Aucune position. */
export const evenementSosSchema = z
  .object({ ...evenementBase, type: z.literal("SOS"), visiteId: identifiantSchema.optional() })
  .strict();

export const evenementSchema = z.discriminatedUnion("type", [
  evenementCheckInSchema,
  evenementCheckOutSchema,
  evenementKayeBrouillonSchema,
  evenementKayePublicationSchema,
  evenementSosSchema,
]);
export type Evenement = z.infer<typeof evenementSchema>;
export type TypeEvenement = Evenement["type"];

/** Corps de POST /evenements. Les événements sont traités DANS L'ORDRE du tableau. */
export const demandeEvenementsSchema = z
  .object({
    evenements: z.array(evenementSchema).min(1).max(MAX_EVENEMENTS_PAR_LOT),
  })
  .strict()
  .superRefine((v, ctx) => {
    v.evenements.forEach((e, i) => {
      if (e.type === "CHECK_IN" && !e.codeDomicile && !e.qr && !e.position) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evenements", i, "codeDomicile"], message: "QR, code du domicile ou position obligatoire." });
      }
      if (e.type === "KAYE_PUBLICATION" && e.kaye.aSurveiller && !e.kaye.noteSurveillance) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evenements", i, "kaye", "noteSurveillance"], message: "Dites ce qu'il faut surveiller." });
      }
    });
  });
export type DemandeEvenements = z.infer<typeof demandeEvenementsSchema>;

/** ACCEPTE : traité. DOUBLON : déjà reçu (résultat d'origine renvoyé). REFUSE : refus métier, ne pas renvoyer. */
export const statutResultatSchema = z.enum(["ACCEPTE", "DOUBLON", "REFUSE"]);

/** Motif d'un refus. L'app décide sur le motif ; le message s'affiche tel quel. */
export const motifRefusSchema = z.enum([
  /** Visite inconnue ou d'un autre accompagnant (même réponse). */
  "INTROUVABLE",
  /** Profil suspendu, refusé ou pas encore validé. */
  "COMPTE_INACTIF",
  /** Action interdite (mission suspendue, trop d'essais de code, position déjà lue). */
  "INTERDIT",
  /** Déjà fait (check-out, Kayé publié) ou visite terminée. */
  "CONFLIT",
  /** Donnée refusée (code faux, check-in pas encore fait, hors délai). */
  "INVALIDE",
  /**
   * L1d (D9) : Koudmen est en préinscription (données réelles des aînés fermées). Rien n'est gardé,
   * pas même en brouillon. L'app vide sa file pour cet événement et affiche le message.
   */
  "PREINSCRIPTION",
  /** L1d (D8, D9) : l'accord de l'aîné manque, est refusé ou retiré. Rien n'est gardé. */
  "ACCORD_MANQUANT",
]);
export type MotifRefus = z.infer<typeof motifRefusSchema>;

/** L1-B (§ 2.3) : statut de la preuve de présence après un CHECK_IN. */
export const statutPreuveCheckInSchema = z.enum(["VALIDE", "A_VERIFIER", "REFUSE"]);
export type StatutPreuveCheckIn = z.infer<typeof statutPreuveCheckInSchema>;
/** L1-B (§ 2.3) : contrôle du check-in, même forme que `controleCheckInSchema` de l'app (L1-C). */
export const controleCheckInSchema = z
  .object({
    statut: statutPreuveCheckInSchema,
    /** Raison en français simple, affichable telle quelle. */
    raison: z.string().max(300).nullable().optional(),
  })
  .strict();
export type ControleCheckIn = z.infer<typeof controleCheckInSchema>;
/** L1-B (P1/P8) : écart réception − survenue au-delà duquel un check-in passe « À vérifier » (minutes). */
export const ECART_RECEPTION_CHECKIN_MAX_MIN = 30;

/** Résultat d'un facteur de preuve au check-in. */
export const resultatPreuveSchema = z
  .object({
    valide: z.boolean(),
    message: z.string().nullable(),
  })
  .strict();

export const resultatEvenementSchema = z
  .object({
    clientEventId: z.string().uuid(),
    type: z.enum(["CHECK_IN", "CHECK_OUT", "KAYE_BROUILLON", "KAYE_PUBLICATION", "SOS"]),
    statut: statutResultatSchema,
    /** Pour un DOUBLON : statut du premier traitement (EN_COURS si un envoi parallèle le traite encore). */
    statutOrigine: z.enum(["ACCEPTE", "REFUSE", "EN_COURS"]).optional(),
    motif: motifRefusSchema.optional(),
    message: z.string().max(300).optional(),
    /** Écart > 12 h entre `survenuA` et l'heure du serveur. La visite passe « À vérifier ». */
    horlogeSuspecte: z.boolean(),
    /** État de la visite après l'événement. */
    visite: z
      .object({ id: identifiantSchema, statut: statutVisiteSchema, score: z.number().int().min(0).max(3) })
      .strict()
      .optional(),
    /** Check-in : résultat de chaque facteur envoyé. */
    preuves: z
      .object({ code: resultatPreuveSchema.optional(), position: resultatPreuveSchema.optional() })
      .strict()
      .optional(),
    /** SOS : consigne à afficher tout de suite. */
    consigne: z.string().optional(),
    /**
     * L1-B (§ 2.3, L10) : CHECK_IN seulement. VALIDE : présence prouvée. A_VERIFIER : check-in accepté, mais la
     * famille employeur doit confirmer (position absente, refusée, simulée, reçue en retard…). REFUSE : QR faux ou
     * révoqué, code faux, hors délai.
     */
    controle: controleCheckInSchema.optional(),
  })
  .strict();
export type ResultatEvenement = z.infer<typeof resultatEvenementSchema>;

export const reponseEvenementsSchema = z
  .object({
    /** Heure de réception par le serveur. */
    recuA: dateIsoSchema,
    /** Un résultat par événement, dans le même ordre. */
    resultats: z.array(resultatEvenementSchema),
  })
  .strict();
export type ReponseEvenements = z.infer<typeof reponseEvenementsSchema>;
