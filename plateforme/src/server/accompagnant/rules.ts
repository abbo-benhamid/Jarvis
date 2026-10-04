/**
 * Règles et validations du Lot B (accompagnant). Fonctions PURES, sans base de données.
 * Importable côté serveur et côté client.
 */
import type {
  Appetite,
  CaregiverStatus,
  CaregiverValidation,
  TimeSlot,
  VerificationStatus,
  VisitStatus,
} from "@prisma/client";
import { z } from "zod";
import { COMMUNE_CODES } from "@/lib/communes";

// ─────────────────────────────── Tarif ───────────────────────────────

/**
 * SMIC horaire brut, en centimes. Rappel affiché au salarié. Le tarif reste LIBRE.
 * [À VÉRIFIER] montant en vigueur (valeur 2025 : 11,88 €). À mettre à jour chaque année.
 */
export const SMIC_HORAIRE_BRUT_CENTS = 1188;
export const RATE_MIN_CENTS = 100;
export const RATE_MAX_CENTS = 15_000;

/** Statuts salariés : le SMIC s'applique. */
export function statusIsSalaried(status: CaregiverStatus | null | undefined): boolean {
  return status === "SALARIE_FAMILLE_CESU" || status === "PROCHE_AIDANT_APA";
}

/** « 15 », « 15,50 », « 15.5 € » → centimes. Null si vide. NaN si invalide. */
export function parseEurosToCents(raw: string | null | undefined): number | null {
  const s = (raw ?? "").replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}

/** Centimes → texte de champ « 15,50 ». */
export function centsToEurosInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}

// ─────────────────────────────── Profil ───────────────────────────────

/** « 3-APRES_MIDI » → { dayOfWeek: 3, slot: "APRES_MIDI" }. */
export function parseAvailabilityKey(key: string): { dayOfWeek: number; slot: TimeSlot } | null {
  const m = /^([0-6])-(MATIN|APRES_MIDI|SOIR)$/.exec(key);
  if (!m) return null;
  return { dayOfWeek: Number(m[1]), slot: m[2] as TimeSlot };
}

export function availabilityKey(a: { dayOfWeek: number; slot: TimeSlot }): string {
  return `${a.dayOfWeek}-${a.slot}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : null));

export const profileSchema = z.object({
  communes: z
    .array(z.enum(COMMUNE_CODES, { errorMap: () => ({ message: "Commune inconnue." }) }))
    .max(34)
    .transform((a) => [...new Set(a)]),
  availabilities: z
    .array(z.string())
    .max(21)
    .transform((keys, ctx) => {
      const out: { dayOfWeek: number; slot: TimeSlot }[] = [];
      const seen = new Set<string>();
      for (const k of keys) {
        const a = parseAvailabilityKey(k);
        if (!a) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Créneau inconnu." });
          return z.NEVER;
        }
        if (!seen.has(k)) out.push(a);
        seen.add(k);
      }
      return out;
    }),
  hourlyRate: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const cents = parseEurosToCents(v);
      if (cents === null) return null;
      if (Number.isNaN(cents) || cents < RATE_MIN_CENTS || cents > RATE_MAX_CENTS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Écrivez un montant en euros entre 1 et 150, par exemple 15 ou 15,50.",
        });
        return z.NEVER;
      }
      return cents;
    }),
  bio: optionalText(600),
  associationName: optionalText(120),
  saadName: optionalText(120),
  siret: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{14}$/.test(v.replace(/\s/g, ""))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le SIRET a 14 chiffres." });
        return z.NEVER;
      }
      return v;
    }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export type ProfileSnapshot = {
  status: CaregiverStatus | null;
  communes: string[];
  availabilityCount: number;
  hourlyRateCents: number | null;
  associationName: string | null;
  saadName: string | null;
  siret: string | null;
};

export type MissingItem = { key: string; label: string; href: string };

/** Ce qui manque au profil pour demander la vérification. */
export function missingProfileItems(p: ProfileSnapshot): MissingItem[] {
  const out: MissingItem[] = [];
  if (!p.status) {
    out.push({ key: "status", label: "Faire l'orientation (5 questions)", href: "/accompagnant/orientation" });
    return out;
  }
  if (p.communes.length === 0)
    out.push({ key: "communes", label: "Choisir au moins une commune", href: "/accompagnant/profil" });
  if (p.availabilityCount === 0)
    out.push({ key: "availabilities", label: "Indiquer au moins une disponibilité", href: "/accompagnant/profil" });
  if (p.status !== "BENEVOLE_ASSO" && p.hourlyRateCents == null)
    out.push({ key: "hourlyRate", label: "Fixer votre tarif horaire", href: "/accompagnant/profil" });
  if (p.status === "BENEVOLE_ASSO" && !p.associationName)
    out.push({ key: "associationName", label: "Indiquer votre association", href: "/accompagnant/profil" });
  if (p.status === "SAAD" && !p.saadName)
    out.push({ key: "saadName", label: "Indiquer votre SAAD", href: "/accompagnant/profil" });
  if (p.status === "AUTO_ENTREPRENEUR_SAP" && !p.siret)
    out.push({ key: "siret", label: "Indiquer votre SIRET", href: "/accompagnant/profil" });
  return out;
}

/** Toutes les vérifications sont déclarées (ou déjà validées). */
export function verificationsReady(items: { status: VerificationStatus }[]): boolean {
  return items.length > 0 && items.every((i) => i.status === "DECLARE" || i.status === "VALIDE");
}

/** L'accompagnant peut-il demander la vérification de son profil ? */
export function canSubmitForReview(
  validation: CaregiverValidation,
  profile: ProfileSnapshot,
  items: { status: VerificationStatus }[],
): boolean {
  return (
    (validation === "BROUILLON" || validation === "REFUSE") &&
    missingProfileItems(profile).length === 0 &&
    verificationsReady(items)
  );
}

/** L'orientation se refait tant que le profil n'est pas vérifié (ni suspendu). */
export function canRedoOrientation(validation: CaregiverValidation): boolean {
  return validation !== "VALIDE" && validation !== "SUSPENDU";
}

// ─────────────────────────────── Vérifications ───────────────────────────────

export const declarationSchema = z.object({
  itemId: z.string().cuid(),
  declaration: z
    .string()
    .trim()
    .min(3, "Écrivez une courte déclaration (3 caractères minimum).")
    .max(300, "300 caractères maximum."),
});

export function canDeclare(status: VerificationStatus): boolean {
  return status !== "VALIDE";
}

// ─────────────────────────────── Propositions ───────────────────────────────

export const acceptSchema = z.object({ proposalId: z.string().cuid() });

export const declineSchema = z.object({
  proposalId: z.string().cuid(),
  declineNote: optionalText(500),
});

// ─────────────────────────────── Visite : check-in ───────────────────────────────

/** Fenêtre de check-in hors mode test : de 2 h avant le début à 2 h après la fin prévue. */
export const CHECKIN_EARLY_MINUTES = 120;
export const CHECKIN_LATE_MINUTES = 120;
export const MAX_CODE_ATTEMPTS = 5;

export const gpsCheckInSchema = z.object({
  visitId: z.string().cuid(),
  consent: z.literal("oui", { errorMap: () => ({ message: "Votre accord est obligatoire." }) }),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100_000).optional(),
});

export const codeCheckInSchema = z.object({
  visitId: z.string().cuid(),
  code: z.string().trim().min(1, "Écrivez le code du domicile.").max(12, "Le code a 6 caractères."),
});

export const visitIdSchema = z.object({ visitId: z.string().cuid() });

export type CheckInWindowState = "TROP_TOT" | "OUVERT" | "TROP_TARD";

/** Le check-in est-il possible maintenant ? En mode test : permis avant l'heure, jusqu'à la fin + 2 h. */
export function checkInWindow(
  visit: { scheduledStart: Date; scheduledEnd: Date },
  now: Date,
  testMode: boolean,
): CheckInWindowState {
  if (now.getTime() > visit.scheduledEnd.getTime() + CHECKIN_LATE_MINUTES * 60_000) return "TROP_TARD";
  if (!testMode && now.getTime() < visit.scheduledStart.getTime() - CHECKIN_EARLY_MINUTES * 60_000) return "TROP_TOT";
  return "OUVERT";
}

/** Une preuve peut-elle encore être ajoutée par l'accompagnant ? (pas après le check-out) */
export function visitAcceptsProof(visit: { status: VisitStatus; checkOutAt: Date | null }): boolean {
  return visit.checkOutAt === null && visit.status !== "A_VERIFIER";
}

// ─────────────────────────────── Kayé ───────────────────────────────

export const APPETITE_VALUES = ["BON", "MOYEN", "FAIBLE", "NON_OBSERVE"] as const satisfies readonly Appetite[];

export const kayeSchema = z
  .object({
    visitId: z.string().cuid(),
    mood: z.coerce
      .number({ invalid_type_error: "Choisissez l'humeur." })
      .int("Choisissez l'humeur.")
      .min(1, "Choisissez l'humeur.")
      .max(5, "Choisissez l'humeur."),
    appetite: z.enum(APPETITE_VALUES, { errorMap: () => ({ message: "Choisissez l'appétit." }) }),
    activities: z
      .array(z.string().trim().min(1).max(40, "40 caractères maximum par activité."))
      .max(10, "10 activités maximum."),
    otherActivity: optionalText(40),
    note: optionalText(500),
    alertFlag: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    alertNote: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (v.alertFlag && !v.alertNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alertNote"],
        message: "Dites en quelques mots ce qu'il faut surveiller.",
      });
    }
  })
  .transform((v) => ({
    visitId: v.visitId,
    mood: v.mood,
    appetite: v.appetite,
    activities: [...new Set([...v.activities, ...(v.otherActivity ? [v.otherActivity] : [])])].slice(0, 10),
    note: v.note,
    alertFlag: v.alertFlag,
    alertNote: v.alertFlag ? v.alertNote : null,
  }));
export type KayeInput = z.infer<typeof kayeSchema>;

/** Le Kayé s'écrit après le check-in, une seule fois par visite. */
export function canWriteKaye(visit: { checkInAt: Date | null; hasJournal: boolean }): boolean {
  return visit.checkInAt !== null && !visit.hasJournal;
}

// ─────────────────────────────── Utilitaire FormData ───────────────────────────────

/** FormData → objet. Les clés listées dans `arrays` deviennent des tableaux. Ignore les champs internes de Next. */
export function formDataToObject(formData: FormData, arrays: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of arrays) out[key] = [];
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    if (arrays.includes(k)) (out[k] as string[]).push(v);
    else out[k] = v;
  }
  return out;
}
