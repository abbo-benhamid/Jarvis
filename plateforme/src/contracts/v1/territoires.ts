/**
 * Contrat API v1 — territoires (lot T1, arbitrage `docs/revues/T1-arbitrage-guadeloupe.md`, décisions T1 à T9).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * Le territoire est une DONNÉE. Au lancement, seule la Guadeloupe est OUVERTE. Les autres territoires sont
 * « Bientôt » : pas d'aîné, de demande, de mission ni de zone d'intervention ; une liste d'attente seulement.
 *
 * Routes (publiques, sans jeton) :
 * - GET  /api/v1/territoires   → les 4 territoires (état, fuseau IANA, indicatifs, communes avec leur centre).
 * - POST /api/v1/liste-attente → 202 {} TOUJOURS (même réponse si l'e-mail est déjà inscrit : aucune fuite).
 */
import { z } from "zod";

/** Ordre d'ouverture prévu (T1) : Guadeloupe, puis Martinique, Guyane, Hexagone. */
export const TERRITOIRES = ["GUADELOUPE", "MARTINIQUE", "GUYANE", "HEXAGONE"] as const;
export const territoireSchema = z.enum(TERRITOIRES);
export type CodeTerritoire = z.infer<typeof territoireSchema>;

/** OUVERT : on peut créer un aîné, une demande, une mission, une zone d'intervention. BIENTOT : liste d'attente seulement. */
export const etatTerritoireSchema = z.enum(["OUVERT", "BIENTOT"]);
export type EtatTerritoire = z.infer<typeof etatTerritoireSchema>;

/** Code de commune : majuscules et « _ » (ex. « POINTE_A_PITRE », « LAMENTIN_GP »). Unique sur tous les territoires. */
export const codeCommuneSchema = z.string().trim().min(2).max(60).regex(/^[A-Z_]+$/);

export const communeTerritoireSchema = z
  .object({
    code: codeCommuneSchema,
    /** Nom affichable (ex. « Pointe-à-Pitre »). */
    libelle: z.string(),
    /** Regroupement pour l'affichage (ex. « Grande-Terre »). */
    zone: z.string(),
    /** Centre approximatif de la commune (± 1 km) : position par défaut du domicile. */
    lat: z.number(),
    lng: z.number(),
  })
  .strict();
export type CommuneTerritoire = z.infer<typeof communeTerritoireSchema>;

export const territoireInfoSchema = z
  .object({
    code: territoireSchema,
    /** Nom affichable (ex. « Guadeloupe »). */
    nom: z.string(),
    /** « heure de Guadeloupe », « heure de Paris »… */
    libelleHeure: z.string(),
    etat: etatTerritoireSchema,
    /** Fuseau IANA (ex. « America/Guadeloupe »). Toute heure de visite s'affiche dans CE fuseau. */
    fuseau: z.string(),
    /** Indicatif téléphonique (ex. « +590 »). */
    indicatif: z.string(),
    /** Préfixes E.164 des mobiles (ex. « +590690 »). */
    prefixesMobiles: z.array(z.string()),
    /** Centre de la carte. */
    centre: z.object({ lat: z.number(), lng: z.number(), zoom: z.number() }).strict(),
    /** Liste fermée des communes. Vide = saisie libre de la commune avec un code postal (Guyane, Hexagone en T1). */
    communes: z.array(communeTerritoireSchema),
  })
  .strict();
export type TerritoireInfo = z.infer<typeof territoireInfoSchema>;

export const reponseTerritoiresSchema = z
  .object({
    territoires: z.array(territoireInfoSchema),
  })
  .strict();
export type ReponseTerritoires = z.infer<typeof reponseTerritoiresSchema>;

// ─────────────── Liste d'attente ───────────────

/** Version du texte de la case de consentement (preuve du consentement). */
export const LISTE_ATTENTE_CONSENTEMENT_VERSION = "T1-2026-10";
/** Texte exact de la case à cocher (obligatoire). */
export const LISTE_ATTENTE_CONSENTEMENT_TEXTE =
  "J'accepte que Koudmen garde mon adresse e-mail pour me prévenir quand Koudmen ouvre dans ce territoire. Je peux retirer mon accord à tout moment. Koudmen efface l'adresse après 12 mois.";
/** Durée de conservation d'une inscription sur la liste d'attente. */
export const LISTE_ATTENTE_CONSERVATION_MOIS = 12;

export const demandeListeAttenteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    /** Un territoire « Bientôt ». Un territoire ouvert répond aussi 202 (rien n'est gardé). */
    territoire: territoireSchema,
    /** Case de consentement explicite, non cochée par défaut. */
    consentement: z.literal(true),
  })
  .strict();
export type DemandeListeAttente = z.infer<typeof demandeListeAttenteSchema>;

/** Toujours la même réponse (aucune fuite d'existence d'une inscription). */
export const reponseListeAttenteSchema = z.object({}).strict();
export type ReponseListeAttente = z.infer<typeof reponseListeAttenteSchema>;
