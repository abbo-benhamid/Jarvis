import { z } from "zod";
import { NOM_PERSONNE_MAX, NOM_PERSONNE_REGEX } from "@/contracts/v1/inscription";

/** L1d (D6) : prénom ou nom d'un compte. Mêmes règles que l'API v1 (pas d'URL, pas de chiffre, 40 caractères). */
const NAME_RULE = "Lettres, espaces, tirets et apostrophes seulement.";
export const personNameSchema = (label: string) =>
  z.string().trim().min(1, `${label} obligatoire.`).max(NOM_PERSONNE_MAX, `${NOM_PERSONNE_MAX} caractères maximum.`).regex(NOM_PERSONNE_REGEX, NAME_RULE);

export const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide.").max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Saisissez votre mot de passe."),
  next: z.string().optional(),
});

/** Champ texte facultatif : une chaîne vide devient `undefined`. */
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

/**
 * L2 / R6 : inscription ouverte (famille ou accompagnant). Le mot de passe passe AUSSI par la politique
 * (liste de refus) dans `registration.ts`. CGU = case obligatoire ; confidentialité = lien (pas de case) ;
 * e-mails d'information = case facultative séparée.
 */
export const registerSchema = z
  .object({
    role: z.enum(["FAMILLE", "ACCOMPAGNANT"], { message: "Choisissez un type de compte." }),
    firstName: personNameSchema("Prénom"),
    lastName: personNameSchema("Nom"),
    email: emailSchema,
    password: z.string().min(10, "10 caractères minimum.").max(200, "200 caractères maximum."),
    phone: optional(z.string().trim().regex(/^\+?[0-9 .-]{6,20}$/, "Saisissez un numéro valide (exemple : +596 696 12 34 56).")),
    commune: optional(z.string().trim().max(60)),
    birthDate: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Saisissez votre date de naissance.")),
    location: optional(z.enum(["MARTINIQUE", "HEXAGONE", "AUTRE"], { message: "Indiquez où vous habitez." })),
    city: optional(z.string().trim().max(80, "80 caractères maximum.")),
    acceptCgu: z.literal("on", { message: "Acceptez les conditions d'utilisation pour créer un compte." }),
    newsOptIn: optional(z.literal("on")),
    // Famille : déclaration d'âge (l'accompagnant donne sa date de naissance).
    adult: optional(z.literal("on")),
    next: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "FAMILLE") {
      if (!v.location) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["location"], message: "Indiquez où vous habitez." });
      if (!v.adult) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["adult"], message: "Koudmen est réservé aux personnes de 18 ans ou plus." });
    } else {
      if (!v.phone) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Saisissez votre numéro de téléphone." });
      if (!v.commune) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["commune"], message: "Choisissez votre commune." });
      if (!v.birthDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["birthDate"], message: "Saisissez votre date de naissance." });
    }
  });

/** L3 : « mot de passe oublié » (web). */
export const forgotPasswordSchema = z.object({ email: emailSchema });

/** L3 : nouveau mot de passe (web). */
export const newPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: z.string().min(10, "10 caractères minimum.").max(200, "200 caractères maximum."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les deux mots de passe sont différents." });

/** Empêche les redirections ouvertes : accepte seulement un chemin interne. */
export function safeNextPath(next: string | undefined | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
