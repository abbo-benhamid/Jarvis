import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide.").max(200);
export const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum.")
  .max(100, "100 caractères maximum.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Saisissez votre mot de passe."),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    role: z.enum(["FAMILLE", "ACCOMPAGNANT"], { message: "Choisissez un type de compte." }),
    firstName: z.string().trim().min(1, "Prénom obligatoire.").max(80),
    lastName: z.string().trim().min(1, "Nom obligatoire.").max(80),
    email: emailSchema,
    password: passwordSchema,
    location: z.enum(["MARTINIQUE", "HEXAGONE", "AUTRE"]).optional(),
    city: z.string().trim().max(80).optional(),
    acceptTest: z.literal("on", {
      message: "Confirmez que vous utilisez uniquement des données fictives.",
    }),
  })
  .refine((v) => v.role !== "FAMILLE" || v.location !== undefined, {
    path: ["location"],
    message: "Indiquez où vous habitez.",
  });

/** Empêche les redirections ouvertes : accepte seulement un chemin interne. */
export function safeNextPath(next: string | undefined | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
