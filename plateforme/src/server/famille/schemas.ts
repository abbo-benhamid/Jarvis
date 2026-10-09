/**
 * Validation Zod des formulaires de l'espace Famille (Lot A). Fonctions PURES.
 * Le serveur valide TOUJOURS. Les messages sont courts, au vouvoiement (STE).
 */
import { z } from "zod";
import { COMMUNE_CODES } from "@/lib/communes";
import { DEFAULT_TZ } from "@/lib/format";

/** A6 : lien de rattachement d'un proche aidant à un aîné. */
export const caregiverLinkSchema = z.object({ aineId: z.string().cuid() });

export const NEED_VALUES = [
  "COMPAGNIE",
  "APPEL_REGULIER",
  "COURSES",
  "REPAS",
  "DEMARCHES",
  "NUMERIQUE",
  "SORTIES",
  "RENDEZ_VOUS",
  "AIDE_LEVER",
  "AIDE_RENFORCEE",
] as const;

export const FREQUENCY_VALUES = ["PONCTUELLE", "HEBDOMADAIRE", "DEUX_PAR_SEMAINE", "QUOTIDIENNE"] as const;
export const SLOT_VALUES = ["MATIN", "APRES_MIDI", "SOIR"] as const;
export const PLAN_VALUES = ["LAKOU", "KOZE", "SERENITE"] as const;
export const DURATION_OPTIONS = [60, 90, 120, 180, 240] as const;

const id = z.string({ message: "Identifiant manquant." }).cuid("Identifiant invalide.");

/** Champ texte facultatif : une chaîne vide devient `undefined`. */
const optionalText = (max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, message).optional(),
  );

const levelField = z.coerce
  .number({ message: "Choisissez un niveau." })
  .int("Choisissez un niveau.")
  .min(1, "Choisissez un niveau entre 1 et 4.")
  .max(4, "Choisissez un niveau entre 1 et 4.");

/** Initiale du nom : une lettre, normalisée en « J. ». */
const lastInitialField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .regex(/^\p{L}\.?$/u, "Saisissez une seule lettre (exemple : J).")
    .transform((s) => `${s.charAt(0).toLocaleUpperCase("fr-FR")}.`)
    .optional(),
);

/** Téléphone fictif : chiffres, espaces, +, points, tirets. */
const phoneField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .regex(/^\+?[0-9 .-]{6,20}$/, "Saisissez un numéro valide (exemple : +596 596 00 00 00).")
    .optional(),
);

export const aineSchema = z.object({
  firstName: z.string({ message: "Prénom obligatoire." }).trim().min(1, "Prénom obligatoire.").max(60, "60 caractères maximum."),
  lastInitial: lastInitialField,
  commune: z.enum(COMMUNE_CODES, { message: "Choisissez une commune." }),
  addressHint: optionalText(160, "160 caractères maximum."),
  // L1-B (L8) : adresse exacte (facultative), chiffrée en base, géocodée. Vide = centre de la commune.
  address: optionalText(200, "200 caractères maximum."),
  phone: phoneField,
  needs: z.array(z.enum(NEED_VALUES), { message: "Choisissez au moins un besoin." }).min(1, "Choisissez au moins un besoin."),
  activityLevel: levelField,
  consentGiven: z.literal("on", { message: "Le consentement est obligatoire." }),
  consentByType: z.enum(["AINE", "REPRESENTANT"], { message: "Indiquez qui donne son accord." }),
  consentByName: z
    .string({ message: "Nom de la personne obligatoire." })
    .trim()
    .min(2, "Nom de la personne obligatoire.")
    .max(120, "120 caractères maximum."),
});
export type AineInput = z.infer<typeof aineSchema>;

/** Création : on demande aussi le lien du créateur avec l'aîné (« fille », « neveu »…). */
export const aineCreateSchema = aineSchema.extend({
  myRelation: z
    .string({ message: "Indiquez votre lien avec l'aîné." })
    .trim()
    .min(2, "Indiquez votre lien avec l'aîné.")
    .max(60, "60 caractères maximum."),
});

export const aineUpdateSchema = aineSchema.extend({ aineId: id });

/**
 * R5 (J5) : en mode lancement, la famille crée l'aîné avec le MINIMUM (prénom, commune, téléphone).
 * Rien d'autre tant que l'aîné n'a pas donné son accord au conseiller Koudmen (appel + notice FALC).
 */
export const aineLaunchCreateSchema = z.object({
  firstName: aineSchema.shape.firstName,
  commune: aineSchema.shape.commune,
  phone: z.string({ message: "Le conseiller appelle l'aîné à ce numéro." }).trim().regex(/^\+?[0-9 .-]{6,20}$/, "Saisissez un numéro valide (exemple : +596 596 00 00 00)."),
  myRelation: aineCreateSchema.shape.myRelation,
});

/** R5 : en lancement, l'accord n'est jamais saisi par la famille (le conseiller l'enregistre). */
/** L1d (M6) : à la modification, les besoins sont facultatifs (la famille peut ajouter seulement l'adresse). */
export const aineLaunchUpdateSchema = aineSchema
  .omit({ consentGiven: true, consentByType: true, consentByName: true })
  .extend({ aineId: id, needs: z.array(z.enum(NEED_VALUES)).default([]) });

export const invitationSchema = z.object({
  aineId: id,
  relation: z.string({ message: "Indiquez le lien avec l'aîné." }).trim().min(2, "Indiquez le lien avec l'aîné.").max(60, "60 caractères maximum."),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(200).optional(),
  ),
});

/** Jeton d'invitation : base64url (aléatoire) ou jeton de démo. */
export const tokenSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const joinSchema = z.object({ token: tokenSchema });

/** Créneau « jour-créneau », ex. « 0-MATIN » (0 = lundi). */
export const slotSchema = z
  .string()
  .regex(/^[0-6]-(MATIN|APRES_MIDI|SOIR)$/, "Créneau invalide.")
  .transform((s) => {
    const [day, slot] = s.split("-");
    return { dayOfWeek: Number(day), slot: slot as (typeof SLOT_VALUES)[number] };
  });

/** Date « AAAA-MM-JJ » facultative, pas dans le passé (comparée à `today`). */
export function startDateField(today: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
      .refine((d) => !Number.isNaN(new Date(`${d}T12:00:00Z`).getTime()), "Date invalide.")
      .refine((d) => d >= today, "Choisissez une date à partir d'aujourd'hui.")
      .optional(),
  );
}

export function careRequestSchema(today: string) {
  return z.object({
    aineId: id,
    level: levelField,
    frequency: z.enum(FREQUENCY_VALUES, { message: "Choisissez une fréquence." }),
    slots: z.array(slotSchema).max(21),
    durationMinutes: z.coerce
      .number({ message: "Choisissez une durée." })
      .int()
      .refine((n) => (DURATION_OPTIONS as readonly number[]).includes(n), "Choisissez une durée."),
    startDate: startDateField(today),
    notes: optionalText(500, "500 caractères maximum."),
    // D6 : qui emploie l'accompagnant (ou reçoit la facture).
    employerType: z.enum(["AINE", "REPRESENTANT"], { message: "Indiquez qui emploie l'accompagnant." }).default("AINE"),
    employerName: optionalText(120, "120 caractères maximum."),
  });
}

export const chooseProfileSchema = z.object({ proposalId: id });

export const cancelRequestSchema = z.object({ requestId: id });
export const confirmVisitSchema = z.object({ visitId: id });
export const changePlanSchema = z.object({
  aineId: id,
  plan: z.enum(PLAN_VALUES, { message: "Choisissez une formule." }),
});

/**
 * Convertit un FormData en objet. Les champs répétés (cases à cocher) deviennent
 * des tableaux quand leur nom figure dans `arrays`.
 */
export function formDataToObject(formData: FormData, arrays: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of arrays) out[key] = [];
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string") continue;
    if (arrays.includes(k)) (out[k] as string[]).push(v);
    else out[k] = v;
  }
  return out;
}

/** Date du jour « AAAA-MM-JJ » dans le fuseau donné (territoire de lancement par défaut, T4). */
export function todayIso(now: Date = new Date(), tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
